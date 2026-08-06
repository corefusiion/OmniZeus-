
ALTER TABLE public.challenge_members ALTER COLUMN bonus_points TYPE numeric(8,2) USING bonus_points::numeric;
ALTER TABLE public.roulette_spins ALTER COLUMN points_awarded TYPE numeric(6,2) USING points_awarded::numeric;

DROP FUNCTION IF EXISTS public.leaderboard_top_v1(uuid, integer);
CREATE OR REPLACE FUNCTION public.leaderboard_top_v1(_challenge_id uuid, _limit integer DEFAULT 3)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, total_points numeric, counted_days bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH agg AS (
    SELECT
      c.user_id,
      COALESCE(SUM(c.points_awarded), 0)::numeric AS total_points,
      COUNT(DISTINCT c.occurred_on) FILTER (WHERE c.over_limit = false)::BIGINT AS counted_days
    FROM public.checkins c
    WHERE c.challenge_id = _challenge_id
      AND (c.ai_validated IS DISTINCT FROM 'rejected')
    GROUP BY c.user_id
  ),
  with_bonus AS (
    SELECT
      m.user_id,
      COALESCE(a.total_points, 0)::numeric + COALESCE(m.bonus_points, 0)::numeric AS total_points,
      COALESCE(a.counted_days, 0) AS counted_days
    FROM public.challenge_members m
    LEFT JOIN agg a ON a.user_id = m.user_id
    WHERE m.challenge_id = _challenge_id
  )
  SELECT
    b.user_id,
    p.display_name,
    p.username::TEXT,
    p.avatar_url,
    b.total_points::numeric,
    b.counted_days::BIGINT
  FROM with_bonus b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE COALESCE(p.is_bot, false) = false
  ORDER BY b.total_points DESC, b.counted_days DESC
  LIMIT GREATEST(_limit, 1);
$function$;
