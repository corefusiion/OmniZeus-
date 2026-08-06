
-- Allow admins to edit posts/comments/checkins (delete already allowed)
DROP POLICY IF EXISTS "posts: update own" ON public.posts;
CREATE POLICY "posts: update own or admin" ON public.posts FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "post_comments: update own" ON public.post_comments;
CREATE POLICY "post_comments: update own or admin" ON public.post_comments FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users update own checkins" ON public.checkins;
CREATE POLICY "Users update own or admin checkins" ON public.checkins FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users update own comments" ON public.checkin_comments;
CREATE POLICY "Users update own or admin comments" ON public.checkin_comments FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
