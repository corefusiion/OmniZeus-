-- Allow platform super admins to see any challenge without requiring a service-role fallback in app code.
DROP POLICY IF EXISTS "super admins can view all challenges" ON public.challenges;
CREATE POLICY "super admins can view all challenges"
ON public.challenges
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow platform super admins to delete any challenge through normal authenticated RLS.
DROP POLICY IF EXISTS "super admins can delete challenges" ON public.challenges;
CREATE POLICY "super admins can delete challenges"
ON public.challenges
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow platform super admins to manage challenge member rows without being participants.
DROP POLICY IF EXISTS "super admins manage all challenge members" ON public.challenge_members;
CREATE POLICY "super admins manage all challenge members"
ON public.challenge_members
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Owners who are also super admins can transfer ownership before leaving.
DROP POLICY IF EXISTS "super admin owners update their challenges" ON public.challenges;
CREATE POLICY "super admin owners update their challenges"
ON public.challenges
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- After transfer, the former owner can delete their own member row.
DROP POLICY IF EXISTS "members can delete own member row" ON public.challenge_members;
CREATE POLICY "members can delete own member row"
ON public.challenge_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);