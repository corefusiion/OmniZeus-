
-- BODY_METRICS_HISTORY
ALTER TABLE public.body_metrics_history
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS muscle_mass_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS water_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS visceral_fat NUMERIC,
  ADD COLUMN IF NOT EXISTS metabolic_age INT,
  ADD COLUMN IF NOT EXISTS body_type TEXT,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_front_path TEXT,
  ADD COLUMN IF NOT EXISTS photo_side_path TEXT,
  ADD COLUMN IF NOT EXISTS ai_notes JSONB,
  ADD COLUMN IF NOT EXISTS shared_with_challenge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS week_of DATE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'body_metrics_source_check') THEN
    ALTER TABLE public.body_metrics_history
      ADD CONSTRAINT body_metrics_source_check
      CHECK (source IN ('manual','ai_scan','bluetooth','weigh_in'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS body_metrics_user_recorded_idx
  ON public.body_metrics_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS body_metrics_challenge_week_idx
  ON public.body_metrics_history(challenge_id, week_of)
  WHERE challenge_id IS NOT NULL;

-- CHALLENGES
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS weigh_in_day_of_week INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weigh_in_enabled BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenges_weigh_in_dow_check') THEN
    ALTER TABLE public.challenges
      ADD CONSTRAINT challenges_weigh_in_dow_check
      CHECK (weigh_in_day_of_week BETWEEN 0 AND 6);
  END IF;
END $$;

-- CHALLENGE_MEMBERS
ALTER TABLE public.challenge_members
  ADD COLUMN IF NOT EXISTS weigh_in_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_weigh_in_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_weigh_in_week DATE;

-- PROFILES
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_composition BOOLEAN NOT NULL DEFAULT false;

-- RLS peers
DROP POLICY IF EXISTS "peers can read shared body metrics" ON public.body_metrics_history;
CREATE POLICY "peers can read shared body metrics"
  ON public.body_metrics_history
  FOR SELECT
  TO authenticated
  USING (
    shared_with_challenge = true
    AND challenge_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = body_metrics_history.user_id AND p.share_composition = true
    )
    AND public.is_challenge_member(auth.uid(), challenge_id)
  );

-- BADGES catalog (schema: slug, name, description, icon, criteria jsonb)
INSERT INTO public.badges (slug, name, description, icon, criteria) VALUES
  ('first_scan', 'Primeira análise IA', 'Fez seu primeiro AI Body Scan', '🤖', '{"type":"first_scan"}'::jsonb),
  ('transformation', 'Transformação', 'Reduziu 3% de gordura corporal desde o primeiro scan', '✨', '{"type":"transformation","fat_delta":-3}'::jsonb),
  ('consistent_4w', 'Consistente', '4 pesagens semanais consecutivas', '📅', '{"type":"weigh_in_streak","weeks":4}'::jsonb),
  ('disciplined_12w', 'Disciplinado', '12 pesagens semanais consecutivas', '🎯', '{"type":"weigh_in_streak","weeks":12}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Streak recalc
CREATE OR REPLACE FUNCTION public.recalc_weigh_in_streak(_user_id UUID, _challenge_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _streak INT := 0;
  _prev DATE;
  _cur RECORD;
  _last DATE;
  _longest INT;
BEGIN
  SELECT MAX(week_of) INTO _last
  FROM public.body_metrics_history
  WHERE user_id = _user_id AND challenge_id = _challenge_id AND source = 'weigh_in';

  IF _last IS NULL THEN
    UPDATE public.challenge_members
      SET weigh_in_streak = 0, last_weigh_in_week = NULL
      WHERE user_id = _user_id AND challenge_id = _challenge_id;
    RETURN;
  END IF;

  IF _last < (date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 days') THEN
    _streak := 0;
  ELSE
    _prev := _last;
    _streak := 1;
    FOR _cur IN
      SELECT DISTINCT week_of
      FROM public.body_metrics_history
      WHERE user_id = _user_id AND challenge_id = _challenge_id
        AND source = 'weigh_in' AND week_of < _last
      ORDER BY week_of DESC
    LOOP
      IF _cur.week_of = _prev - INTERVAL '7 days' THEN
        _streak := _streak + 1;
        _prev := _cur.week_of;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;

  SELECT GREATEST(longest_weigh_in_streak, _streak) INTO _longest
    FROM public.challenge_members
    WHERE user_id = _user_id AND challenge_id = _challenge_id;

  UPDATE public.challenge_members
    SET weigh_in_streak = _streak,
        longest_weigh_in_streak = COALESCE(_longest, _streak),
        last_weigh_in_week = _last
    WHERE user_id = _user_id AND challenge_id = _challenge_id;

  IF _streak >= 4 THEN
    PERFORM public.award_badge(_user_id, 'consistent_4w', _challenge_id);
  END IF;
  IF _streak >= 12 THEN
    PERFORM public.award_badge(_user_id, 'disciplined_12w', _challenge_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_body_metrics_weigh_in_streak()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.source = 'weigh_in' AND NEW.challenge_id IS NOT NULL THEN
    PERFORM public.recalc_weigh_in_streak(NEW.user_id, NEW.challenge_id);
  ELSIF TG_OP = 'DELETE' AND OLD.source = 'weigh_in' AND OLD.challenge_id IS NOT NULL THEN
    PERFORM public.recalc_weigh_in_streak(OLD.user_id, OLD.challenge_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_body_metrics_weigh_in_streak ON public.body_metrics_history;
CREATE TRIGGER trg_body_metrics_weigh_in_streak
  AFTER INSERT OR UPDATE OR DELETE ON public.body_metrics_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_body_metrics_weigh_in_streak();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_metrics_history TO authenticated;
GRANT ALL ON public.body_metrics_history TO service_role;
