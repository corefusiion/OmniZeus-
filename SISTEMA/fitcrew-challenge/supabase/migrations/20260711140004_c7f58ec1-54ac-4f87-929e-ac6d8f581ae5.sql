
CREATE TABLE IF NOT EXISTS public.reactivation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_whatsapp TEXT NOT NULL,
  requested_start_date DATE NOT NULL,
  requested_end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by UUID,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.reactivation_requests TO authenticated;
GRANT ALL ON public.reactivation_requests TO service_role;

ALTER TABLE public.reactivation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge admins can insert reactivation requests"
  ON public.reactivation_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_challenge_admin(auth.uid(), challenge_id));

CREATE POLICY "Challenge admins can view their own requests"
  ON public.reactivation_requests
  FOR SELECT
  TO authenticated
  USING (public.is_challenge_admin(auth.uid(), challenge_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update requests"
  ON public.reactivation_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_reactivation_requests_updated_at
  BEFORE UPDATE ON public.reactivation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_reactivation_requests_status ON public.reactivation_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactivation_requests_challenge ON public.reactivation_requests(challenge_id);
