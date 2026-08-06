-- 1) Waist measurement
ALTER TABLE public.body_metrics_history
  ADD COLUMN IF NOT EXISTS waist_cm numeric(5,1);

-- 2) Body composition goals (AI-generated coach snapshot per metric row)
CREATE TABLE IF NOT EXISTS public.body_composition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_id uuid REFERENCES public.body_metrics_history(id) ON DELETE CASCADE,
  ideal_weight_kg numeric(5,1),
  weight_delta_kg numeric(5,1),
  fat_delta_kg numeric(5,1),
  muscle_delta_kg numeric(5,1),
  bmi numeric(4,1),
  body_type_key text,
  narrative text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bcg_user ON public.body_composition_goals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bcg_metric ON public.body_composition_goals(metric_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_composition_goals TO authenticated;
GRANT ALL ON public.body_composition_goals TO service_role;

ALTER TABLE public.body_composition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own goals"
  ON public.body_composition_goals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);