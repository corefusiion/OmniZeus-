CREATE OR REPLACE FUNCTION public.join_challenge_by_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _challenge_id uuid;
  _is_active boolean;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT c.id, c.is_active
    INTO _challenge_id, _is_active
  FROM public.challenges c
  WHERE upper(trim(c.invite_code)) = upper(trim(_code))
    AND c.invite_enabled = true
  LIMIT 1;

  IF _challenge_id IS NULL THEN
    RAISE EXCEPTION 'Código de convite não encontrado.';
  END IF;

  IF _is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Este convite foi desativado pelo dono do desafio.';
  END IF;

  INSERT INTO public.challenge_members (challenge_id, user_id, role)
  VALUES (_challenge_id, _user_id, 'member')
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RETURN _challenge_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_challenge_by_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_invite(text) TO authenticated;