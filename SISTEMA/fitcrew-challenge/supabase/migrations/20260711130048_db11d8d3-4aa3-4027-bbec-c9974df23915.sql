
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS tavily_api_key text;

DROP FUNCTION IF EXISTS public.get_active_ai_config();

CREATE FUNCTION public.get_active_ai_config()
RETURNS TABLE(provider text, model_name text, image_model_name text, api_key text, tavily_api_key text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT provider, model_name, image_model_name, api_key, tavily_api_key
  FROM public.ai_settings
  WHERE id = true
  LIMIT 1;
$function$;

UPDATE public.ai_settings
SET tavily_api_key = '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'
WHERE id = true;

INSERT INTO public.ai_settings (id, tavily_api_key)
SELECT true, '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'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings WHERE id = true);
