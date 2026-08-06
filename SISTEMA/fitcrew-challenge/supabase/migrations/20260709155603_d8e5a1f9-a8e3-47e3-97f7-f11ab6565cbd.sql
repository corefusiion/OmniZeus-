
-- 1. Fix: private challenges leaking to any authed user
DROP POLICY IF EXISTS "challenges visible to members" ON public.challenges;
CREATE POLICY "challenges visible to members"
  ON public.challenges FOR SELECT
  TO authenticated
  USING (is_challenge_member(auth.uid(), id));

-- 2. Fix: anonymous invite scraping
DROP POLICY IF EXISTS "public invite lookup" ON public.challenges;

CREATE OR REPLACE FUNCTION public.get_challenge_by_invite(_code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  starts_at date,
  ends_at date,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, c.starts_at, c.ends_at, c.is_active
  FROM public.challenges c
  WHERE c.invite_code = _code
    AND c.invite_enabled = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_challenge_by_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_challenge_by_invite(text) TO anon, authenticated;

-- 3. Fix: mentions readable by everyone
DROP POLICY IF EXISTS "authenticated read mentions" ON public.mentions;
CREATE POLICY "users read own mentions"
  ON public.mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid() OR author_id = auth.uid());
