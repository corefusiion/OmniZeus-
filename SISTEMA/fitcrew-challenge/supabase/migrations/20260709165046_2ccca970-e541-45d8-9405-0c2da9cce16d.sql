
-- Roleta da Recompensa Semanal
CREATE TABLE public.roulette_spins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- segunda-feira da semana à qual o giro se refere (a semana passada)
  eligible BOOLEAN NOT NULL, -- se foi perfeito na semana passada
  prize_key TEXT, -- chave do prêmio sorteado (null se inelegível)
  prize_label TEXT,
  prize_tier TEXT, -- 'coin' | 'points' | 'troll'
  points_awarded INT NOT NULL DEFAULT 0,
  spun_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roulette_spins TO authenticated;
GRANT ALL ON public.roulette_spins TO service_role;

ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own spins" ON public.roulette_spins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own spins" ON public.roulette_spins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own spins" ON public.roulette_spins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_roulette_spins_user_challenge ON public.roulette_spins (user_id, challenge_id, week_start);

-- Função: verifica se o usuário foi "perfeito" naquele desafio na semana passada
-- Perfeito = counted_days (over_limit=false) na semana passada >= max_days_per_week do desafio,
-- limitado ao intervalo em que o desafio estava ativo dentro daquela semana.
CREATE OR REPLACE FUNCTION public.was_perfect_last_week(_user_id UUID, _challenge_id UUID)
RETURNS TABLE (
  eligible BOOLEAN,
  week_start DATE,
  counted_days INT,
  required_days INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tz TEXT := 'America/Sao_Paulo';
  _today DATE := (now() AT TIME ZONE _tz)::date;
  _monday_this DATE := (_today - ((EXTRACT(ISODOW FROM _today)::int - 1)))::date;
  _monday_last DATE := (_monday_this - 7)::date;
  _sunday_last DATE := (_monday_this - 1)::date;
  _ch RECORD;
  _range_start DATE;
  _range_end DATE;
  _counted INT := 0;
  _required INT := 0;
  _days_in_range INT := 0;
BEGIN
  SELECT starts_at, ends_at, max_days_per_week
    INTO _ch
    FROM public.challenges
    WHERE id = _challenge_id;

  IF _ch IS NULL THEN
    eligible := false; week_start := _monday_last; counted_days := 0; required_days := 0;
    RETURN NEXT; RETURN;
  END IF;

  _range_start := GREATEST(_monday_last, _ch.starts_at);
  _range_end := LEAST(_sunday_last, _ch.ends_at);

  IF _range_start > _range_end THEN
    -- Desafio não estava ativo em nenhum dia da semana passada
    eligible := false; week_start := _monday_last; counted_days := 0; required_days := 0;
    RETURN NEXT; RETURN;
  END IF;

  _days_in_range := (_range_end - _range_start) + 1;
  _required := LEAST(COALESCE(_ch.max_days_per_week, 7), _days_in_range);

  SELECT COUNT(DISTINCT occurred_on)::int INTO _counted
    FROM public.checkins
    WHERE user_id = _user_id
      AND challenge_id = _challenge_id
      AND over_limit = false
      AND occurred_on BETWEEN _range_start AND _range_end;

  eligible := (_counted >= _required AND _required > 0);
  week_start := _monday_last;
  counted_days := _counted;
  required_days := _required;
  RETURN NEXT;
END;
$$;
