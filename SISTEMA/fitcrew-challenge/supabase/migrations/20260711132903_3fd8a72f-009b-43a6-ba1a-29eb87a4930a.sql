
ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET display_name = 'FitBot Oficial',
    username = 'fitbot',
    bio = 'Sou o FitBot, mascote oficial do FitCrew 🤖🔥 Posto motivação, dicas de treino e cuido dos desafios abertos até um humano assumir.',
    username_updated_at = now()
WHERE id = 'e63c8e12-1858-4f2d-8552-09592a6f5f6a';

ALTER TABLE public.profiles ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.transfer_bot_challenge_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner UUID;
  _owner_is_bot BOOLEAN;
  _new_is_bot BOOLEAN;
BEGIN
  SELECT owner_id INTO _owner FROM public.challenges WHERE id = NEW.challenge_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_bot, false) INTO _owner_is_bot FROM public.profiles WHERE id = _owner;
  SELECT COALESCE(is_bot, false) INTO _new_is_bot FROM public.profiles WHERE id = NEW.user_id;

  IF _owner_is_bot AND NOT _new_is_bot THEN
    UPDATE public.challenges SET owner_id = NEW.user_id WHERE id = NEW.challenge_id;
    UPDATE public.challenge_members SET role = 'owner'
      WHERE challenge_id = NEW.challenge_id AND user_id = NEW.user_id;
    UPDATE public.challenge_members SET role = 'member'
      WHERE challenge_id = NEW.challenge_id AND user_id = _owner;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_bot_admin ON public.challenge_members;
CREATE TRIGGER trg_transfer_bot_admin
AFTER INSERT ON public.challenge_members
FOR EACH ROW EXECUTE FUNCTION public.transfer_bot_challenge_admin();
