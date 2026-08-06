
-- Composite index: scoped feed reads (posts filtered by challenge_id, ordered by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_posts_challenge_created
  ON public.posts (challenge_id, created_at DESC);

-- Support timeline pagination cursor on posts even without challenge scope
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts (created_at DESC);

-- Cursor pagination for checkins by challenge (created_at DESC already covered but ensure ok)
CREATE INDEX IF NOT EXISTS idx_checkins_challenge_created
  ON public.checkins (challenge_id, created_at DESC);

-- Compact top-N leaderboard: aggregates points and counted days entirely in Postgres.
CREATE OR REPLACE FUNCTION public.leaderboard_top_v1(_challenge_id UUID, _limit INT DEFAULT 3)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  total_points BIGINT,
  counted_days BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      c.user_id,
      COALESCE(SUM(c.points_awarded), 0)::BIGINT AS total_points,
      COUNT(DISTINCT c.occurred_on) FILTER (WHERE c.over_limit = false)::BIGINT AS counted_days
    FROM public.checkins c
    WHERE c.challenge_id = _challenge_id
      AND (c.ai_validated IS DISTINCT FROM 'rejected')
    GROUP BY c.user_id
  ),
  with_bonus AS (
    SELECT
      m.user_id,
      COALESCE(a.total_points, 0) + COALESCE(m.bonus_points, 0) AS total_points,
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
    b.total_points::BIGINT,
    b.counted_days::BIGINT
  FROM with_bonus b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE COALESCE(p.is_bot, false) = false
  ORDER BY b.total_points DESC, b.counted_days DESC
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_top_v1(UUID, INT) TO authenticated;
