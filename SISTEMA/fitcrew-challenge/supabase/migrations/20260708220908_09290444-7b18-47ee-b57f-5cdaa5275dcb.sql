
ALTER TABLE public.challenge_members
  ADD COLUMN IF NOT EXISTS paused_from date,
  ADD COLUMN IF NOT EXISTS paused_until date,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS last_pause_at timestamptz;

-- Validation trigger: max 7 days, once per 30 days
CREATE OR REPLACE FUNCTION public.validate_challenge_pause()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.paused_until IS NOT NULL AND NEW.paused_from IS NOT NULL THEN
    IF NEW.paused_until < NEW.paused_from THEN
      RAISE EXCEPTION 'paused_until deve ser >= paused_from';
    END IF;
    IF (NEW.paused_until - NEW.paused_from) > 6 THEN
      RAISE EXCEPTION 'A pausa não pode exceder 7 dias.';
    END IF;
    IF NEW.paused_from < CURRENT_DATE THEN
      RAISE EXCEPTION 'A pausa deve começar hoje ou no futuro.';
    END IF;
    -- 30-day cooldown (skip when clearing)
    IF (OLD.paused_until IS DISTINCT FROM NEW.paused_until
        OR OLD.paused_from IS DISTINCT FROM NEW.paused_from)
       AND OLD.last_pause_at IS NOT NULL
       AND OLD.last_pause_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'Você só pode pausar uma vez a cada 30 dias.';
    END IF;
    NEW.last_pause_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_challenge_pause ON public.challenge_members;
CREATE TRIGGER trg_validate_challenge_pause
  BEFORE UPDATE ON public.challenge_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_challenge_pause();

-- Update recalc_streak to respect pause window
CREATE OR REPLACE FUNCTION public.recalc_streak(_user_id uuid, _challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _streak INT := 0;
  _last DATE;
  _prev DATE;
  _cur RECORD;
  _longest INT;
  _pause_from DATE;
  _pause_until DATE;
  _pause_days INT := 0;
  _threshold DATE;
BEGIN
  SELECT paused_from, paused_until INTO _pause_from, _pause_until
    FROM public.challenge_members
    WHERE user_id = _user_id AND challenge_id = _challenge_id;

  IF _pause_from IS NOT NULL AND _pause_until IS NOT NULL
     AND _pause_until >= CURRENT_DATE - INTERVAL '1 day' THEN
    -- active or just-ended pause: count effective days elapsed within pause window (up to today)
    _pause_days := GREATEST(0, LEAST(_pause_until, CURRENT_DATE)::date - _pause_from + 1);
  END IF;

  SELECT MAX(occurred_on) INTO _last
  FROM public.checkins
  WHERE user_id = _user_id AND challenge_id = _challenge_id AND over_limit = false;

  IF _last IS NULL THEN
    UPDATE public.challenge_members
      SET current_streak = 0, last_checkin_date = NULL
      WHERE user_id = _user_id AND challenge_id = _challenge_id;
    RETURN;
  END IF;

  _threshold := (CURRENT_DATE - INTERVAL '1 day')::date - _pause_days;

  IF _last < _threshold THEN
    _streak := 0;
  ELSE
    _prev := _last;
    _streak := 1;
    FOR _cur IN
      SELECT DISTINCT occurred_on
      FROM public.checkins
      WHERE user_id = _user_id AND challenge_id = _challenge_id AND over_limit = false
        AND occurred_on < _last
      ORDER BY occurred_on DESC
    LOOP
      IF _cur.occurred_on = _prev - INTERVAL '1 day' THEN
        _streak := _streak + 1;
        _prev := _cur.occurred_on;
      ELSIF _pause_from IS NOT NULL
            AND _cur.occurred_on = _pause_from - INTERVAL '1 day'
            AND _prev = LEAST(_pause_until, CURRENT_DATE) + INTERVAL '1 day' THEN
        -- bridge across pause window
        _streak := _streak + 1;
        _prev := _cur.occurred_on;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;

  SELECT GREATEST(longest_streak, _streak) INTO _longest
    FROM public.challenge_members
    WHERE user_id = _user_id AND challenge_id = _challenge_id;

  UPDATE public.challenge_members
    SET current_streak = _streak,
        longest_streak = COALESCE(_longest, _streak),
        last_checkin_date = _last
    WHERE user_id = _user_id AND challenge_id = _challenge_id;
END;
$$;
