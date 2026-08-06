
-- Pokes table: tracks each "Cutucar" event with anti-spam constraints
CREATE TABLE public.pokes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  poker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  roast_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (poker_id <> target_id)
);

CREATE INDEX pokes_target_challenge_idx ON public.pokes (target_id, challenge_id, created_at DESC);
CREATE INDEX pokes_poker_target_idx ON public.pokes (poker_id, target_id, created_at DESC);

GRANT SELECT, INSERT ON public.pokes TO authenticated;
GRANT ALL ON public.pokes TO service_role;

ALTER TABLE public.pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pokes in their challenges"
  ON public.pokes FOR SELECT
  TO authenticated
  USING (public.is_challenge_member(auth.uid(), challenge_id));

CREATE POLICY "Users can create pokes as themselves"
  ON public.pokes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = poker_id
    AND poker_id <> target_id
    AND public.is_challenge_member(auth.uid(), challenge_id)
  );

-- Mark posts as system-authored (Coach FitCrew) and categorize
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_kind TEXT;
