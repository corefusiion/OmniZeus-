
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS checkin_cooldown_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS duration_bonus_step_min integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS duration_bonus_cap_pct integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS tiebreak_duration_cap_min integer NOT NULL DEFAULT 120;

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_checkin_cooldown_min_ck CHECK (checkin_cooldown_min >= 0 AND checkin_cooldown_min <= 240),
  ADD CONSTRAINT challenges_duration_bonus_step_min_ck CHECK (duration_bonus_step_min >= 5 AND duration_bonus_step_min <= 120),
  ADD CONSTRAINT challenges_duration_bonus_cap_pct_ck CHECK (duration_bonus_cap_pct >= 0 AND duration_bonus_cap_pct <= 200),
  ADD CONSTRAINT challenges_tiebreak_duration_cap_min_ck CHECK (tiebreak_duration_cap_min >= 15 AND tiebreak_duration_cap_min <= 600);

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS points_base integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_duration_bonus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_streak_bonus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_reason text;

COMMENT ON COLUMN public.challenges.checkin_cooldown_min IS 'Minutos mínimos entre check-ins manuais do mesmo usuário.';
COMMENT ON COLUMN public.challenges.duration_bonus_step_min IS 'Concede +1 ponto a cada N minutos acima do mínimo do exercício.';
COMMENT ON COLUMN public.challenges.duration_bonus_cap_pct IS 'Teto do bônus por duração como % dos pontos base do exercício.';
COMMENT ON COLUMN public.challenges.tiebreak_duration_cap_min IS 'Máximo de minutos por check-in usados no desempate por duração.';
COMMENT ON COLUMN public.checkins.points_reason IS 'Motivo da pontuação (ex: over_limit_semanal, ja_pontuou_dia, ok).';
