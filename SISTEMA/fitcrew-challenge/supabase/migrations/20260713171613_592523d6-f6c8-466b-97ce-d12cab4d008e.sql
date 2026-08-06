-- Remove column-level SELECT on invite_code from anon and authenticated.
-- The get_challenge_by_invite RPC (SECURITY DEFINER) continues to expose it via the invite flow.
REVOKE SELECT (invite_code) ON public.challenges FROM anon;
REVOKE SELECT (invite_code) ON public.challenges FROM authenticated;

-- Re-grant SELECT on all non-sensitive columns so normal reads keep working.
-- (Column list generated from information_schema, excluding invite_code.)
DO $$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO col_list
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'challenges'
     AND column_name <> 'invite_code';

  EXECUTE format('GRANT SELECT (%s) ON public.challenges TO anon', col_list);
  EXECUTE format('GRANT SELECT (%s) ON public.challenges TO authenticated', col_list);
END $$;

-- service_role keeps full access
GRANT ALL ON public.challenges TO service_role;