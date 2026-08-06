
-- 1) Allow super_admin to delete/update posts and post_comments via RLS (no service role needed)
DROP POLICY IF EXISTS "posts delete own or admin" ON public.posts;
CREATE POLICY "posts delete own or admin"
  ON public.posts FOR DELETE
  USING (
    auth.uid() = user_id
    OR (challenge_id IS NOT NULL AND is_challenge_admin(auth.uid(), challenge_id))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "posts update own or admin" ON public.posts;
CREATE POLICY "posts update own or admin"
  ON public.posts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (challenge_id IS NOT NULL AND is_challenge_admin(auth.uid(), challenge_id))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Also loosen post_comments so super admins can delete abusive comments
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, cmd FROM pg_policies WHERE tablename='post_comments' AND schemaname='public' AND cmd IN ('DELETE','UPDATE')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.post_comments', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "post_comments delete own or admin"
  ON public.post_comments FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "post_comments update own or admin"
  ON public.post_comments FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2) Contact info table — email + phone visible only to super_admins
CREATE TABLE IF NOT EXISTS public.user_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_contacts TO authenticated;
GRANT ALL ON public.user_contacts TO service_role;
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

-- Owner can read/insert/update own row
DROP POLICY IF EXISTS "own contact read" ON public.user_contacts;
CREATE POLICY "own contact read" ON public.user_contacts
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS "own contact insert" ON public.user_contacts;
CREATE POLICY "own contact insert" ON public.user_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "contact update own or super" ON public.user_contacts;
CREATE POLICY "contact update own or super" ON public.user_contacts
  FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));

-- Backfill from auth.users (migration runs with elevated privileges)
INSERT INTO public.user_contacts (user_id, email, phone)
SELECT id, email, COALESCE(phone, raw_user_meta_data->>'phone')
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    phone = COALESCE(public.user_contacts.phone, EXCLUDED.phone),
    updated_at = now();

-- 3) Update handle_new_user trigger to also persist email + phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.user_contacts (user_id, email, phone)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone'))
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_user_contacts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS user_contacts_updated_at ON public.user_contacts;
CREATE TRIGGER user_contacts_updated_at BEFORE UPDATE ON public.user_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_contacts_updated_at();
