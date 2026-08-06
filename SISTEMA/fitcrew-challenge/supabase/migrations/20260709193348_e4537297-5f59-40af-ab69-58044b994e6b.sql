
-- 1) Table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invites_code_idx ON public.invites (code);
CREATE INDEX invites_created_by_idx ON public.invites (created_by);

-- 2) GRANTs (no anon: validation goes through SECURITY DEFINER RPC)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;

-- 3) RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites: owner or admin can select"
ON public.invites FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Invites: authenticated can create own"
ON public.invites FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Invites: owner or admin can update"
ON public.invites FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Invites: owner or admin can delete"
ON public.invites FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) updated_at trigger
CREATE TRIGGER trg_invites_updated_at
BEFORE UPDATE ON public.invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Public availability check (usable by anon during signup)
CREATE OR REPLACE FUNCTION public.is_invite_available(_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE code = upper(trim(_code))
      AND is_used = false
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_invite_available(TEXT) TO anon, authenticated;

-- 6) Code generator (FIT-XXXX, 4 uppercase alphanumerics, unique)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _code TEXT;
  _tries INT := 0;
BEGIN
  LOOP
    _code := 'FIT-' ||
      substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1) ||
      substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1) ||
      substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1) ||
      substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invites WHERE code = _code);
    _tries := _tries + 1;
    IF _tries > 50 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;
  RETURN _code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;

-- 7) Seed the first invite so the community can bootstrap (only if table is empty)
INSERT INTO public.invites (code, created_by, is_used)
SELECT 'FIT-VIP1', NULL, false
WHERE NOT EXISTS (SELECT 1 FROM public.invites);
