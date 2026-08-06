
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS absence_penalty_pts numeric(6,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  absence_date date NOT NULL,
  penalty_pts numeric(6,2) NOT NULL DEFAULT 0,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id, absence_date)
);

CREATE INDEX IF NOT EXISTS absences_challenge_date_idx
  ON public.absences (challenge_id, absence_date DESC);

GRANT SELECT ON public.absences TO authenticated;
GRANT ALL ON public.absences TO service_role;

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view absences in their challenge"
  ON public.absences FOR SELECT
  TO authenticated
  USING (public.is_challenge_member(auth.uid(), challenge_id));
