
CREATE TABLE public.ai_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.ai_coach_messages TO authenticated;
GRANT ALL ON public.ai_coach_messages TO service_role;

ALTER TABLE public.ai_coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own coach messages"
  ON public.ai_coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user writes own coach messages"
  ON public.ai_coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user deletes own coach messages"
  ON public.ai_coach_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_ai_coach_messages_user_created
  ON public.ai_coach_messages(user_id, created_at DESC);
