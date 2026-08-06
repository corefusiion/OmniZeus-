
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT,
  model_name TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_settings_singleton CHECK (id = true),
  CONSTRAINT ai_settings_provider_check CHECK (provider IN ('openai','gemini','openrouter','anthropic','grok'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_ai_settings" ON public.ai_settings;
CREATE POLICY "super_admin_select_ai_settings" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin_write_ai_settings" ON public.ai_settings;
CREATE POLICY "super_admin_write_ai_settings" ON public.ai_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_settings (id, provider, model_name)
VALUES (true, 'openai', 'gpt-4o-mini')
ON CONFLICT (id) DO NOTHING;
