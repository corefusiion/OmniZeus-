
-- 1. Streak columns on challenge_members
ALTER TABLE public.challenge_members
  ADD COLUMN IF NOT EXISTS current_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin_date DATE;

-- 2. Function to recalc streak for one (user, challenge)
CREATE OR REPLACE FUNCTION public.recalc_streak(_user_id uuid, _challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _streak INT := 0;
  _last DATE;
  _prev DATE;
  _cur RECORD;
  _longest INT;
BEGIN
  SELECT MAX(occurred_on) INTO _last
  FROM public.checkins
  WHERE user_id = _user_id AND challenge_id = _challenge_id AND over_limit = false;

  IF _last IS NULL THEN
    UPDATE public.challenge_members
      SET current_streak = 0, last_checkin_date = NULL
      WHERE user_id = _user_id AND challenge_id = _challenge_id;
    RETURN;
  END IF;

  -- If most-recent counted day is older than yesterday relative to today, streak is broken (0)
  IF _last < (CURRENT_DATE - INTERVAL '1 day')::date THEN
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

-- 3. Trigger on checkins
CREATE OR REPLACE FUNCTION public.trg_checkins_recalc_streak()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_streak(NEW.user_id, NEW.challenge_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_streak(OLD.user_id, OLD.challenge_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_streak(NEW.user_id, NEW.challenge_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS checkins_recalc_streak ON public.checkins;
CREATE TRIGGER checkins_recalc_streak
  AFTER INSERT OR UPDATE OR DELETE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkins_recalc_streak();

-- 4. Backfill existing streaks
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id, challenge_id FROM public.checkins LOOP
    PERFORM public.recalc_streak(r.user_id, r.challenge_id);
  END LOOP;
END $$;

-- 5. Custom reactions: relax emoji column
ALTER TABLE public.checkin_reactions
  DROP CONSTRAINT IF EXISTS checkin_reactions_emoji_check;
ALTER TABLE public.checkin_reactions
  ALTER COLUMN emoji TYPE TEXT;
ALTER TABLE public.checkin_reactions
  ADD CONSTRAINT checkin_reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 12);

-- Also relax post_reactions if it has the same constraint
ALTER TABLE public.post_reactions
  DROP CONSTRAINT IF EXISTS post_reactions_emoji_check;
ALTER TABLE public.post_reactions
  ALTER COLUMN emoji TYPE TEXT;
ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 12);
