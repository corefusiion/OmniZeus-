
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS photo_flag_codes TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.checkin_moderation_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('auto_flagged','approved','rejected','needs_review')),
  reasons TEXT[] NOT NULL DEFAULT '{}',
  reasons_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_moderation_audit_checkin_idx
  ON public.checkin_moderation_audit(checkin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkin_moderation_audit_challenge_idx
  ON public.checkin_moderation_audit(challenge_id, created_at DESC);

GRANT SELECT ON public.checkin_moderation_audit TO authenticated;
GRANT ALL ON public.checkin_moderation_audit TO service_role;

ALTER TABLE public.checkin_moderation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or challenge admin can read audit"
ON public.checkin_moderation_audit
FOR SELECT
TO authenticated
USING (
  public.is_challenge_admin(auth.uid(), challenge_id)
  OR EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_moderation_audit.checkin_id
      AND c.user_id = auth.uid()
  )
);
