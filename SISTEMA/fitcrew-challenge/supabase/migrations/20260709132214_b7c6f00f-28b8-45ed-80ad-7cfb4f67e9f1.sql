
CREATE OR REPLACE FUNCTION public.list_challenge_members_v2(_challenge_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.username, p.avatar_url
  FROM public.challenge_members cm
  JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.challenge_id = _challenge_id
    AND COALESCE(p.is_bot, false) = false
  ORDER BY p.display_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_challenge_members_v2(uuid) TO authenticated;
