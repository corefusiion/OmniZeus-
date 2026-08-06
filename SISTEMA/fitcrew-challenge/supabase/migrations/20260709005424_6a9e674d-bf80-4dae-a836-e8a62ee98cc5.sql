-- Promote CEO/Developer to super_admin
DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT u.id INTO _uid
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower('jsgleisson@gmail.com')
     OR p.username = 'gsantos'::citext
  LIMIT 1;

  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Helper: is_super_admin (SECURITY DEFINER, same pattern as has_role)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
