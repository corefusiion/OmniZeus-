
DROP POLICY IF EXISTS "Challenger can create duel" ON public.duels;

CREATE POLICY "Challenger can create duel"
  ON public.duels FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = challenger_id
    AND challenger_id <> opponent_id
    AND public.is_challenge_member(auth.uid(), challenge_id)
    AND (
      public.is_challenge_member(opponent_id, challenge_id)
      OR EXISTS (
        SELECT 1 FROM public.checkins ck
        WHERE ck.challenge_id = duels.challenge_id
          AND ck.user_id = duels.opponent_id
        LIMIT 1
      )
    )
  );
