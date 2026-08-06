
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sex_enum') THEN
    CREATE TYPE public.sex_enum AS ENUM ('M', 'F');
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sex public.sex_enum;
ALTER TABLE public.body_metrics_history ADD COLUMN IF NOT EXISTS sex public.sex_enum;
