ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS checkins_batch_id_idx ON public.checkins(batch_id);