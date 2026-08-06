
CREATE TABLE public.meal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  meal_type TEXT NOT NULL,
  food_description TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6,2) NOT NULL DEFAULT 0,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'chat',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_logs TO authenticated;
GRANT ALL ON public.meal_logs TO service_role;

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal logs" ON public.meal_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX meal_logs_user_date_idx ON public.meal_logs (user_id, occurred_on DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meal_logs_updated_at
BEFORE UPDATE ON public.meal_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
