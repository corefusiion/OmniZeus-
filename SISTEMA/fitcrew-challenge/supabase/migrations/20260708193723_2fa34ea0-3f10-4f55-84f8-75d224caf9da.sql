
-- 1) Extend challenges with entry fee, currency, prize split, tiebreakers
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS entry_fee numeric(10,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS prize_split jsonb NOT NULL DEFAULT '[{"position":1,"percent":70},{"position":2,"percent":20},{"position":3,"percent":10}]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiebreakers jsonb NOT NULL DEFAULT '["days","duration","first_to_reach","weight_evolution"]'::jsonb;

-- 2) AI validation columns on checkins
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS ai_validated text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_notes text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_ai_validated_check') THEN
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_ai_validated_check
      CHECK (ai_validated IN ('pending','approved','needs_review','rejected'));
  END IF;
END $$;

-- 3) Challenge participants (pot tracker)
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

GRANT SELECT ON public.challenge_participants TO authenticated;
GRANT ALL ON public.challenge_participants TO service_role;

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select_all_auth" ON public.challenge_participants;
CREATE POLICY "participants_select_all_auth" ON public.challenge_participants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "participants_admin_write" ON public.challenge_participants;
CREATE POLICY "participants_admin_write" ON public.challenge_participants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Ensure only admins can update challenges (settings changes)
DROP POLICY IF EXISTS "challenges_admin_update" ON public.challenges;
CREATE POLICY "challenges_admin_update" ON public.challenges
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) Uniqueness: 1 bot comment per checkin / post (via a partial index using a coach flag on comments)
-- We'll just rely on app-level check + a helper flag column:
ALTER TABLE public.checkin_comments
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS checkin_comments_one_bot_per_checkin
  ON public.checkin_comments(checkin_id) WHERE is_bot;
CREATE UNIQUE INDEX IF NOT EXISTS post_comments_one_bot_per_post
  ON public.post_comments(post_id) WHERE is_bot;
