GRANT INSERT ON public.ai_usage_logs TO authenticated;
DROP POLICY IF EXISTS "own_ai_usage_insert" ON public.ai_usage_logs;
CREATE POLICY "own_ai_usage_insert" ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());