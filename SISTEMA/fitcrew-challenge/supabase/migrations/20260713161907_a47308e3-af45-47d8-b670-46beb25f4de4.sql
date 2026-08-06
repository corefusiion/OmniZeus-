
-- 1. daily_poses table
CREATE TABLE public.daily_poses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pose_key TEXT NOT NULL,
  pose_emoji TEXT NOT NULL,
  pose_name TEXT NOT NULL,
  chosen_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_poses TO authenticated;
GRANT ALL ON public.daily_poses TO service_role;

ALTER TABLE public.daily_poses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge members can read daily poses"
  ON public.daily_poses FOR SELECT TO authenticated
  USING (public.is_challenge_member(auth.uid(), challenge_id));

CREATE POLICY "Challenge members can create daily pose"
  ON public.daily_poses FOR INSERT TO authenticated
  WITH CHECK (
    chosen_by_user_id = auth.uid()
    AND public.is_challenge_member(auth.uid(), challenge_id)
  );

CREATE INDEX daily_poses_challenge_date_idx ON public.daily_poses (challenge_id, date);

-- 2. used_daily_pose flag on checkins
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS used_daily_pose BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS checkins_used_daily_pose_idx
  ON public.checkins (challenge_id, user_id) WHERE used_daily_pose = true;
