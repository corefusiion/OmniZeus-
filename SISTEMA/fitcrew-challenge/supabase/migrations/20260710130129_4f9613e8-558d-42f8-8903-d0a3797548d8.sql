CREATE OR REPLACE FUNCTION public.is_invite_available(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.invites
      WHERE code = upper(trim(_code))
        AND is_used = false
        AND (expires_at IS NULL OR expires_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE upper(trim(c.invite_code)) = upper(trim(_code))
        AND c.invite_enabled = true
        AND c.is_active = true
    );
$$;