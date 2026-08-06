ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS image_model_name text;

DROP FUNCTION IF EXISTS public.get_active_ai_config();

CREATE OR REPLACE FUNCTION public.get_active_ai_config()
RETURNS TABLE(provider text, model_name text, image_model_name text, api_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider, model_name, image_model_name, api_key
  FROM public.ai_settings
  WHERE id = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_active_ai_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_ai_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_ai_config() TO service_role;