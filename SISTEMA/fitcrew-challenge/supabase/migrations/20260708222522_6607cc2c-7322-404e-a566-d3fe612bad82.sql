
CREATE OR REPLACE FUNCTION public.award_badge(_user_id UUID, _slug TEXT, _challenge_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _badge_id UUID;
  _badge_name TEXT;
  _badge_icon TEXT;
  _inserted INT := 0;
BEGIN
  SELECT id, name, icon INTO _badge_id, _badge_name, _badge_icon FROM public.badges WHERE slug = _slug;
  IF _badge_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_badges (user_id, badge_id, challenge_id)
    VALUES (_user_id, _badge_id, _challenge_id)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted > 0 THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, source_type, source_id)
    VALUES (
      _user_id,
      'badge_earned',
      _badge_icon || ' Conquista desbloqueada: ' || _badge_name,
      NULL,
      CASE WHEN _challenge_id IS NOT NULL THEN '/c/' || _challenge_id::text ELSE '/profile/' || _user_id::text END,
      'badge',
      _badge_id
    );
  END IF;
  RETURN _inserted > 0;
END;
$$;
