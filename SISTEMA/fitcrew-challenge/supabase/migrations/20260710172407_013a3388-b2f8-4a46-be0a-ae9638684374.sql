
-- 1) exercise_presets table
CREATE TABLE public.exercise_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  category text NOT NULL,
  suggested_points smallint NOT NULL DEFAULT 10,
  suggested_min_minutes smallint NOT NULL DEFAULT 30,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exercise_presets TO authenticated;
GRANT ALL ON public.exercise_presets TO service_role;

ALTER TABLE public.exercise_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read presets"
  ON public.exercise_presets FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER exercise_presets_set_updated_at
  BEFORE UPDATE ON public.exercise_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX exercise_presets_category_idx ON public.exercise_presets (category, sort_order);

-- 2) checkins: hora de início + localização opcional
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS started_at_local time,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy_m real;
