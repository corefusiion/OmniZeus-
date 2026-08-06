
CREATE OR REPLACE FUNCTION public.register_poke(
  _challenge_id uuid,
  _target_id uuid,
  _roast text
)
RETURNS TABLE(post_id uuid, coach_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _poker uuid := auth.uid();
  _coach uuid;
  _post uuid;
  _poker_handle text;
BEGIN
  IF _poker IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF _poker = _target_id THEN
    RAISE EXCEPTION 'Você não pode se cutucar.';
  END IF;

  -- Ambos membros
  IF NOT public.is_challenge_member(_poker, _challenge_id) THEN
    RAISE EXCEPTION 'Você não é membro deste desafio.';
  END IF;
  IF NOT public.is_challenge_member(_target_id, _challenge_id) THEN
    RAISE EXCEPTION 'O alvo não é membro deste desafio.';
  END IF;

  -- Anti-spam: 1 por par a cada 24h
  IF EXISTS (
    SELECT 1 FROM public.pokes
    WHERE poker_id = _poker AND target_id = _target_id
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'Você já cutucou essa pessoa nas últimas 24h.';
  END IF;

  -- Cap: 10 por alvo/24h
  IF (SELECT count(*) FROM public.pokes
      WHERE target_id = _target_id
        AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Este membro já foi bastante cutucado hoje.';
  END IF;

  -- Coach bot
  SELECT id INTO _coach FROM public.profiles WHERE is_bot = true LIMIT 1;
  IF _coach IS NULL THEN
    RAISE EXCEPTION 'Coach bot não configurado.';
  END IF;

  INSERT INTO public.posts (user_id, body, challenge_id, is_system, system_kind)
  VALUES (_coach, '🔥 ' || _roast, _challenge_id, true, 'poke_roast')
  RETURNING id INTO _post;

  INSERT INTO public.pokes (challenge_id, poker_id, target_id, post_id, roast_text)
  VALUES (_challenge_id, _poker, _target_id, _post, _roast);

  SELECT COALESCE(username, display_name, 'colega') INTO _poker_handle
    FROM public.profiles WHERE id = _poker;

  INSERT INTO public.notifications (user_id, actor_id, kind, title, body, link)
  VALUES (
    _target_id, _poker, 'poke',
    '🔥 Você foi cutucado!',
    '@' || _poker_handle || ' pediu pro Coach dar um alô no feed do desafio.',
    '/feed#post-' || _post::text
  );

  post_id := _post;
  coach_id := _coach;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_poke(uuid, uuid, text) TO authenticated;
