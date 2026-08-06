
DO $$ BEGIN
  CREATE TYPE public.photo_source AS ENUM ('camera', 'gallery', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS photo_source public.photo_source NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS photo_taken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_flag_reason TEXT;

CREATE INDEX IF NOT EXISTS checkins_photo_flagged_idx
  ON public.checkins (challenge_id, photo_flagged) WHERE photo_flagged = true;
