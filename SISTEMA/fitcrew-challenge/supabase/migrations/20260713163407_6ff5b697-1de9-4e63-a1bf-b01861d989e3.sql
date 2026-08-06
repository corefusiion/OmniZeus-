ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS reactivated_to_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_reactivated_to ON public.challenges(reactivated_to_id);