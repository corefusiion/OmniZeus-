
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view follows"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow as themselves"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

CREATE POLICY "Users can unfollow their own follows"
  ON public.follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);
