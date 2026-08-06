
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;

-- Backfill member_count
UPDATE public.challenges c
SET member_count = COALESCE((SELECT COUNT(*) FROM public.challenge_members m WHERE m.challenge_id = c.id), 0);

-- Trigger to keep member_count in sync
CREATE OR REPLACE FUNCTION public.sync_challenge_member_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenges SET member_count = member_count + 1 WHERE id = NEW.challenge_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenges SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.challenge_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_challenge_member_count ON public.challenge_members;
CREATE TRIGGER trg_sync_challenge_member_count
AFTER INSERT OR DELETE ON public.challenge_members
FOR EACH ROW EXECUTE FUNCTION public.sync_challenge_member_count();

-- Public read policy for anon: only public + active challenges
DROP POLICY IF EXISTS "Public challenges are viewable by anon" ON public.challenges;
CREATE POLICY "Public challenges are viewable by anon"
ON public.challenges
FOR SELECT
TO anon
USING (is_public = true AND is_active = true);

DROP POLICY IF EXISTS "Public challenges are viewable by authenticated" ON public.challenges;
CREATE POLICY "Public challenges are viewable by authenticated"
ON public.challenges
FOR SELECT
TO authenticated
USING (is_public = true AND is_active = true);

-- Ensure anon can read the table via Data API
GRANT SELECT ON public.challenges TO anon;
