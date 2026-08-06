CREATE TABLE public.challenge_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image','video')),
  caption TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenge_stories_challenge ON public.challenge_stories(challenge_id, created_at DESC);
CREATE INDEX idx_challenge_stories_expires ON public.challenge_stories(expires_at);
CREATE INDEX idx_challenge_stories_author ON public.challenge_stories(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_stories TO authenticated;
GRANT ALL ON public.challenge_stories TO service_role;

ALTER TABLE public.challenge_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view active stories"
  ON public.challenge_stories FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND public.is_challenge_member(auth.uid(), challenge_id)
  );

CREATE POLICY "Members can create their own stories"
  ON public.challenge_stories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_challenge_member(auth.uid(), challenge_id)
  );

CREATE POLICY "Authors or admins can delete stories"
  ON public.challenge_stories FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR public.is_challenge_admin(auth.uid(), challenge_id)
  );

-- Storage RLS (path: {challenge_id}/{author_id}/{filename})
CREATE POLICY "Members can view story media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'story-media'
    AND public.is_challenge_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "Members can upload their story media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'story-media'
    AND auth.uid()::text = split_part(name, '/', 2)
    AND public.is_challenge_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "Authors can delete their story media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'story-media'
    AND auth.uid()::text = split_part(name, '/', 2)
  );

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-expired-stories',
  '0 3 * * *',
  $$ DELETE FROM public.challenge_stories WHERE expires_at < now(); $$
);
