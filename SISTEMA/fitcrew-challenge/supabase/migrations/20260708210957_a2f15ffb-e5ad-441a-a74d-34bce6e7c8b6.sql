
CREATE TABLE public.challenge_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT,
  image_url TEXT,
  checkin_id UUID REFERENCES public.checkins(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_messages_has_content CHECK (
    body IS NOT NULL OR image_url IS NOT NULL OR checkin_id IS NOT NULL
  )
);

CREATE INDEX challenge_messages_challenge_created_idx
  ON public.challenge_messages (challenge_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_messages TO authenticated;
GRANT ALL ON public.challenge_messages TO service_role;

ALTER TABLE public.challenge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read challenge messages"
  ON public.challenge_messages FOR SELECT
  TO authenticated
  USING (public.is_challenge_member(auth.uid(), challenge_id));

CREATE POLICY "Members can send challenge messages"
  ON public.challenge_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_challenge_member(auth.uid(), challenge_id)
  );

CREATE POLICY "Authors can edit their messages"
  ON public.challenge_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors or admins can delete messages"
  ON public.challenge_messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_challenge_admin(auth.uid(), challenge_id)
  );

CREATE TRIGGER challenge_messages_set_updated_at
  BEFORE UPDATE ON public.challenge_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.challenge_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_messages;

-- Storage policies for chat-media bucket (path: <user_id>/<challenge_id>/<file>)
CREATE POLICY "Users can upload their own chat media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Challenge members can read chat media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_challenge_member(
        auth.uid(),
        NULLIF((storage.foldername(name))[2], '')::uuid
      )
    )
  );

CREATE POLICY "Users can delete their own chat media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
