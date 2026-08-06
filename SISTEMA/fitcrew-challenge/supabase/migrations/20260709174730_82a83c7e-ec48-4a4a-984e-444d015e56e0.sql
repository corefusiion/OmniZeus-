
REVOKE ALL ON FUNCTION public.leaderboard_top_v1(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard_top_v1(UUID, INT) TO authenticated;
