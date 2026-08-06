
CREATE TABLE public.duels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake_points INT NOT NULL CHECK (stake_points BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','canceled','resolved')),
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tied BOOLEAN NOT NULL DEFAULT false,
  points_transferred INT NOT NULL DEFAULT 0,
  challenger_points INT,
  opponent_points INT,
  accepted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (challenger_id <> opponent_id)
);

-- Uniqueness: at most one duel per unordered pair per week per challenge
CREATE UNIQUE INDEX duels_unique_pair_week
  ON public.duels (
    challenge_id,
    week_start,
    LEAST(challenger_id, opponent_id),
    GREATEST(challenger_id, opponent_id)
  );

CREATE INDEX duels_challenge_week_idx ON public.duels (challenge_id, week_start);
CREATE INDEX duels_opponent_idx ON public.duels (opponent_id, status);
CREATE INDEX duels_challenger_idx ON public.duels (challenger_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duels TO authenticated;
GRANT ALL ON public.duels TO service_role;

ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;

-- Members of the challenge can view its duels
CREATE POLICY "Challenge members can view duels"
  ON public.duels FOR SELECT
  TO authenticated
  USING (public.is_challenge_member(auth.uid(), challenge_id));

-- Only the challenger themselves can create; opponent must be a member of the same challenge
CREATE POLICY "Challenger can create duel"
  ON public.duels FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = challenger_id
    AND public.is_challenge_member(auth.uid(), challenge_id)
    AND public.is_challenge_member(opponent_id, challenge_id)
    AND challenger_id <> opponent_id
  );

-- Either party can update (accept/decline/cancel) while pending; server functions handle resolution
CREATE POLICY "Participants can update duel"
  ON public.duels FOR UPDATE
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE TRIGGER duels_set_updated_at
  BEFORE UPDATE ON public.duels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
