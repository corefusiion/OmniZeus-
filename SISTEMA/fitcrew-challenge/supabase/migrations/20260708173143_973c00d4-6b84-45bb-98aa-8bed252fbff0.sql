-- Enable citext for case-insensitive usernames
CREATE EXTENSION IF NOT EXISTS citext;

-- Add username column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username citext,
  ADD COLUMN IF NOT EXISTS username_updated_at timestamptz;

-- Unique index (multiple NULLs allowed by default in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.username ~ '^[a-z0-9_]{3,20}$') THEN
    RAISE EXCEPTION 'Username inválido. Use 3-20 caracteres: letras, números e _';
  END IF;

  -- 30-day cooldown on change (skip if inserting or first time setting)
  IF TG_OP = 'UPDATE'
     AND OLD.username IS NOT NULL
     AND OLD.username IS DISTINCT FROM NEW.username
     AND OLD.username_updated_at IS NOT NULL
     AND OLD.username_updated_at > now() - interval '30 days' THEN
    RAISE EXCEPTION 'Você só pode trocar o username uma vez a cada 30 dias.';
  END IF;

  IF TG_OP = 'INSERT' OR OLD.username IS DISTINCT FROM NEW.username THEN
    NEW.username_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_username_trg ON public.profiles;
CREATE TRIGGER validate_username_trg
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- Availability RPC
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (_username ~ '^[a-z0-9_]{3,20}$')
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE username = _username::citext
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated, anon;

-- Update handle_new_user to NOT auto-fill username (force user to choose)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  END IF;

  RETURN NEW;
END;
$$;