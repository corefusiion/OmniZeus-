
-- MENTIONS
CREATE TABLE public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('post','post_comment','checkin','checkin_comment')),
  source_id uuid NOT NULL,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_mentioned ON public.mentions(mentioned_user_id, created_at DESC);
CREATE INDEX idx_mentions_source ON public.mentions(source_type, source_id);
GRANT SELECT, INSERT, DELETE ON public.mentions TO authenticated;
GRANT ALL ON public.mentions TO service_role;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read mentions" ON public.mentions FOR SELECT TO authenticated USING (true);
CREATE POLICY "author insert mentions" ON public.mentions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author delete mentions" ON public.mentions FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('mention','comment','reaction','ai_post','system')),
  source_type text,
  source_id uuid,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- AI MODERATION QUEUE
CREATE TABLE public.ai_moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('post','comment')),
  target_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  body text NOT NULL,
  media_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  published_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  published_comment_id uuid REFERENCES public.post_comments(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_mod_status ON public.ai_moderation_queue(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_moderation_queue TO authenticated;
GRANT ALL ON public.ai_moderation_queue TO service_role;
ALTER TABLE public.ai_moderation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read ai queue" ON public.ai_moderation_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update ai queue" ON public.ai_moderation_queue FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete ai queue" ON public.ai_moderation_queue FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ai_mod_updated_at BEFORE UPDATE ON public.ai_moderation_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AI SCHEDULE CONFIG
CREATE TABLE public.ai_schedule_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cron_expression text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily_post','comment_on_new')),
  prompt text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_schedule_config TO authenticated;
GRANT ALL ON public.ai_schedule_config TO service_role;
ALTER TABLE public.ai_schedule_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read schedules" ON public.ai_schedule_config FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_ai_sched_updated_at BEFORE UPDATE ON public.ai_schedule_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add is_bot to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- Seed default schedules
INSERT INTO public.ai_schedule_config (name, cron_expression, kind, prompt, requires_approval) VALUES
  ('Dica matinal', '0 9 * * *', 'daily_post', 'Escreva uma dica curta e motivadora sobre treino, dieta ou hábitos saudáveis. Máximo 280 caracteres. Em português brasileiro. Use 1-2 emojis.', true),
  ('Comentário em novos posts', '*/15 * * * *', 'comment_on_new', 'Faça um comentário curto, empolgado e positivo (máx 100 chars) sobre o post de treino de um usuário do FitCrew. Em português. Um emoji.', true);
