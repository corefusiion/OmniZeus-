
-- Enforce member_limit on challenge_members via trigger (protects all insert paths)
CREATE OR REPLACE FUNCTION public.enforce_challenge_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit INT;
  _current INT;
  _owner UUID;
BEGIN
  SELECT member_limit, owner_id INTO _limit, _owner
    FROM public.challenges WHERE id = NEW.challenge_id;
  IF _limit IS NULL THEN RETURN NEW; END IF;

  -- owner sempre pode entrar (é criado no fluxo de criação do desafio)
  IF NEW.user_id = _owner THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO _current
    FROM public.challenge_members
    WHERE challenge_id = NEW.challenge_id;

  IF _current >= _limit THEN
    RAISE EXCEPTION 'CHALLENGE_MEMBER_LIMIT_REACHED: Limite de % membros atingido. Assine o PRO para liberar até 300 vagas.', _limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_member_limit ON public.challenge_members;
CREATE TRIGGER trg_challenge_member_limit
  BEFORE INSERT ON public.challenge_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_challenge_member_limit();
