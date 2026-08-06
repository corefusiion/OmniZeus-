
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metrics_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.body_metrics_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric(5,2) NOT NULL,
  height_cm integer,
  bmi numeric(5,2),
  bmr integer,
  note text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date
  ON public.body_metrics_history(user_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.body_metrics_history TO authenticated;
GRANT ALL ON public.body_metrics_history TO service_role;

ALTER TABLE public.body_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own metrics history"
  ON public.body_metrics_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own metrics history"
  ON public.body_metrics_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
