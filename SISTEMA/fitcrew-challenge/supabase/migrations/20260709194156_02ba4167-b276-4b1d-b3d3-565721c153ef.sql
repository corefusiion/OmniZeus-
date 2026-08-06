
CREATE TABLE public.invite_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  invite_id UUID REFERENCES public.invites(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invite_requests_status_idx ON public.invite_requests (status, created_at DESC);
CREATE INDEX invite_requests_email_idx ON public.invite_requests (lower(email));

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_requests TO authenticated;
GRANT ALL ON public.invite_requests TO service_role;
-- Anon needs to submit requests (INSERT only)
GRANT INSERT ON public.invite_requests TO anon;

ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can submit a request
CREATE POLICY "Anyone can request an invite"
ON public.invite_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(trim(email)) BETWEEN 5 AND 255
  AND status = 'pending'
);

-- Only admins can read the queue
CREATE POLICY "Admins read invite requests"
ON public.invite_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (approve/reject)
CREATE POLICY "Admins update invite requests"
ON public.invite_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete invite requests"
ON public.invite_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_invite_requests_updated_at
BEFORE UPDATE ON public.invite_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
