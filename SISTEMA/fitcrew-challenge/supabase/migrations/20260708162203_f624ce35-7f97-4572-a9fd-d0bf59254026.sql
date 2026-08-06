
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.weekly_counted_days(uuid, uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_counted_days(uuid, uuid, date) TO authenticated, service_role;
