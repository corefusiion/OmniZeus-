CREATE TABLE IF NOT EXISTS public.checkin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','upheld')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolver_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkin_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_reports_status ON public.checkin_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_reports_challenge ON public.checkin_reports (challenge_id, status);

GRANT SELECT, INSERT ON public.checkin_reports TO authenticated;
GRANT ALL ON public.checkin_reports TO service_role;

ALTER TABLE public.checkin_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_can_report"
ON public.checkin_reports FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.challenge_members m
    WHERE m.challenge_id = checkin_reports.challenge_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "reporter_or_admin_can_read"
ON public.checkin_reports FOR SELECT
TO authenticated
USING (
  reporter_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.challenge_members m
    WHERE m.challenge_id = checkin_reports.challenge_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','co_admin')
  )
);