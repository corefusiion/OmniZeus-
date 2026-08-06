
-- 1. Badges catalog
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are public" ON public.badges FOR SELECT USING (true);

-- 2. User badges
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id, challenge_id)
);
CREATE INDEX idx_user_badges_user ON public.user_badges(user_id, earned_at DESC);
CREATE INDEX idx_user_badges_challenge ON public.user_badges(challenge_id);
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User badges are public" ON public.user_badges FOR SELECT USING (true);

-- 3. Challenges close columns
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 4. Seed catalogue
INSERT INTO public.badges (slug, name, description, icon, criteria) VALUES
  ('first_checkin', 'Primeiro passo', 'Fez seu primeiro check-in.', '🌱', '{"type":"first_checkin"}'),
  ('streak_7',      '7 dias seguidos', 'Manteve uma sequência de 7 dias.', '🔥', '{"type":"streak","days":7}'),
  ('streak_30',     '30 dias seguidos', 'Manteve uma sequência de 30 dias.', '💎', '{"type":"streak","days":30}'),
  ('checkins_100',  '100 check-ins', 'Completou 100 check-ins.', '💯', '{"type":"total_checkins","count":100}'),
  ('early_bird',    'Madrugador', 'Fez check-in antes das 8h.', '🌅', '{"type":"early_bird"}'),
  ('night_owl',     'Coruja', 'Fez check-in depois das 22h.', '🦉', '{"type":"night_owl"}'),
  ('perfectionist', 'Semana perfeita', 'Bateu a meta semanal de dias.', '⭐', '{"type":"perfect_week"}'),
  ('challenge_winner', 'Campeão', 'Ficou em 1º lugar num desafio encerrado.', '🏆', '{"type":"winner"}')
ON CONFLICT (slug) DO NOTHING;

-- 5. Award function
CREATE OR REPLACE FUNCTION public.award_badge(_user_id UUID, _slug TEXT, _challenge_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _badge_id UUID;
  _inserted BOOLEAN := false;
BEGIN
  SELECT id INTO _badge_id FROM public.badges WHERE slug = _slug;
  IF _badge_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_badges (user_id, badge_id, challenge_id)
    VALUES (_user_id, _badge_id, _challenge_id)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted THEN
    INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (_user_id, 'badge_earned',
      jsonb_build_object('badge_slug', _slug, 'challenge_id', _challenge_id));
  END IF;
  RETURN _inserted;
END;
$$;

-- 6. Trigger to award on checkin
CREATE OR REPLACE FUNCTION public.trg_checkins_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total INT;
  _streak INT;
  _hour INT;
  _weekly INT;
  _max_week INT;
BEGIN
  IF NEW.over_limit THEN RETURN NEW; END IF;

  -- first checkin (any challenge)
  SELECT COUNT(*) INTO _total FROM public.checkins WHERE user_id = NEW.user_id AND over_limit = false;
  IF _total = 1 THEN
    PERFORM public.award_badge(NEW.user_id, 'first_checkin', NEW.challenge_id);
  END IF;
  IF _total >= 100 THEN
    PERFORM public.award_badge(NEW.user_id, 'checkins_100', NULL);
  END IF;

  -- streak based
  SELECT current_streak INTO _streak FROM public.challenge_members
    WHERE user_id = NEW.user_id AND challenge_id = NEW.challenge_id;
  IF _streak >= 7 THEN
    PERFORM public.award_badge(NEW.user_id, 'streak_7', NEW.challenge_id);
  END IF;
  IF _streak >= 30 THEN
    PERFORM public.award_badge(NEW.user_id, 'streak_30', NEW.challenge_id);
  END IF;

  -- time based
  _hour := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'America/Sao_Paulo');
  IF _hour < 8 THEN
    PERFORM public.award_badge(NEW.user_id, 'early_bird', NEW.challenge_id);
  END IF;
  IF _hour >= 22 THEN
    PERFORM public.award_badge(NEW.user_id, 'night_owl', NEW.challenge_id);
  END IF;

  -- perfect week (hit weekly limit)
  SELECT max_days_per_week INTO _max_week FROM public.challenges WHERE id = NEW.challenge_id;
  _weekly := public.weekly_counted_days(NEW.user_id, NEW.challenge_id, NEW.occurred_on);
  IF _max_week IS NOT NULL AND _weekly >= _max_week THEN
    PERFORM public.award_badge(NEW.user_id, 'perfectionist', NEW.challenge_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkins_award_badges ON public.checkins;
CREATE TRIGGER checkins_award_badges
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkins_award_badges();

-- 7. Close expired challenges + award winner
CREATE OR REPLACE FUNCTION public.close_expired_challenges()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ch RECORD;
  _winner UUID;
  _closed INT := 0;
BEGIN
  FOR _ch IN
    SELECT id FROM public.challenges
    WHERE status = 'active' AND ends_at < CURRENT_DATE
  LOOP
    UPDATE public.challenges SET status = 'closed', closed_at = now(), is_active = false WHERE id = _ch.id;
    _closed := _closed + 1;
    SELECT user_id INTO _winner
      FROM public.checkins
      WHERE challenge_id = _ch.id AND over_limit = false
      GROUP BY user_id
      ORDER BY SUM(points_awarded) DESC NULLS LAST
      LIMIT 1;
    IF _winner IS NOT NULL THEN
      PERFORM public.award_badge(_winner, 'challenge_winner', _ch.id);
    END IF;
  END LOOP;
  RETURN _closed;
END;
$$;

-- 8. Schedule daily 04:00 UTC
DO $$ BEGIN
  PERFORM cron.unschedule('close-expired-challenges');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'close-expired-challenges',
  '0 4 * * *',
  $$ SELECT public.close_expired_challenges(); $$
);
