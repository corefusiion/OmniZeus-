
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS reactivation_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactivation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactivation_requested_by UUID;

-- Recreate close_expired_challenges to also send notification to the owner
CREATE OR REPLACE FUNCTION public.close_expired_challenges()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ch RECORD;
  _winner UUID;
  _closed INT := 0;
BEGIN
  FOR _ch IN
    SELECT id, name, owner_id FROM public.challenges
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

    -- Notify owner (if not a bot) that challenge closed
    IF _ch.owner_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = _ch.owner_id AND COALESCE(is_bot, false) = true
    ) THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link, source_type, source_id)
      VALUES (
        _ch.owner_id,
        'challenge_closed',
        '🏁 Seu desafio foi encerrado!',
        'Seu desafio "' || _ch.name || '" foi encerrado! Veja o ranking final e decida se deseja reativar para uma nova temporada.',
        '/c/' || _ch.id::text,
        'challenge',
        _ch.id
      );
    END IF;
  END LOOP;
  RETURN _closed;
END;
$function$;
