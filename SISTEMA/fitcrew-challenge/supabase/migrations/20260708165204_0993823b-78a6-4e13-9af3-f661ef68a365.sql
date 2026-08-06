
-- Extend profiles with fitness/social fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS favorite_sport text;

-- Posts: text-first social posts (optional image)
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts: read for authenticated"
  ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts: insert own"
  ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts: update own"
  ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "posts: delete own or admin"
  ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts (user_id);

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Post reactions
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_reactions: read"
  ON public.post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_reactions: insert own"
  ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_reactions: delete own"
  ON public.post_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS post_reactions_post_idx ON public.post_reactions (post_id);

-- Post comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_comments: read"
  ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_comments: insert own"
  ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_comments: update own"
  ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "post_comments: delete own or admin"
  ON public.post_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id);

CREATE TRIGGER post_comments_set_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
