
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  access_mode TEXT NOT NULL DEFAULT 'closed' CHECK (access_mode IN ('closed','open')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT platform_settings_singleton CHECK (id = TRUE)
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Super admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert platform settings" ON public.platform_settings;
CREATE POLICY "Super admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.platform_settings (id, access_mode) VALUES (TRUE, 'closed') ON CONFLICT (id) DO NOTHING;
