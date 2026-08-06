
-- Banner generation limit counter
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS banner_generations_used int NOT NULL DEFAULT 0;

-- Reinforce RLS on ai_coach_messages + super_admin bypass + missing UPDATE policy
ALTER TABLE public.ai_coach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user updates own coach messages" ON public.ai_coach_messages;
CREATE POLICY "user updates own coach messages"
  ON public.ai_coach_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "super_admin manages all coach messages" ON public.ai_coach_messages;
CREATE POLICY "super_admin manages all coach messages"
  ON public.ai_coach_messages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
