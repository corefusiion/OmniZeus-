
CREATE TYPE public.checkin_source AS ENUM ('manual', 'strava', 'health');

CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_days_per_week smallint NOT NULL DEFAULT 5,
  streak_bonus_points smallint NOT NULL DEFAULT 2,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges viewable by authenticated" ON public.challenges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage challenges" ON public.challenges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_challenges_updated BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.exercise_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  points smallint NOT NULL DEFAULT 10,
  min_minutes smallint NOT NULL DEFAULT 30,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_types TO authenticated;
GRANT ALL ON public.exercise_types TO service_role;
ALTER TABLE public.exercise_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercise types viewable" ON public.exercise_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exercise types" ON public.exercise_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_exercise_types_updated BEFORE UPDATE ON public.exercise_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  exercise_type_id uuid NOT NULL REFERENCES public.exercise_types(id) ON DELETE RESTRICT,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  duration_min smallint NOT NULL,
  photo_url text NOT NULL,
  caption text,
  source public.checkin_source NOT NULL DEFAULT 'manual',
  external_id text,
  points_awarded smallint NOT NULL DEFAULT 0,
  over_limit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_user_date ON public.checkins(user_id, occurred_on);
CREATE INDEX idx_checkins_challenge ON public.checkins(challenge_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checkins viewable by authenticated" ON public.checkins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own checkins" ON public.checkins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own checkins" ON public.checkins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own or admin" ON public.checkins
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_checkins_updated BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.checkin_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checkin_id, user_id, emoji)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_reactions TO authenticated;
GRANT ALL ON public.checkin_reactions TO service_role;
ALTER TABLE public.checkin_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable" ON public.checkin_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own reactions" ON public.checkin_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reactions" ON public.checkin_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.checkin_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_checkin ON public.checkin_comments(checkin_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_comments TO authenticated;
GRANT ALL ON public.checkin_comments TO service_role;
ALTER TABLE public.checkin_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable" ON public.checkin_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own comments" ON public.checkin_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.checkin_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own or admin comments" ON public.checkin_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.checkin_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.weekly_counted_days(_user_id uuid, _challenge_id uuid, _on date)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT occurred_on)::int
  FROM public.checkins
  WHERE user_id = _user_id
    AND challenge_id = _challenge_id
    AND over_limit = false
    AND date_trunc('week', occurred_on) = date_trunc('week', _on);
$$;

WITH new_challenge AS (
  INSERT INTO public.challenges (name, description, starts_at, ends_at, is_active)
  VALUES (
    'Temporada 1',
    'Bora começar! Máx 5 dias/semana contando, mínimo 30 minutos por sessão.',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days',
    true
  )
  RETURNING id
)
INSERT INTO public.exercise_types (challenge_id, name, icon, points, min_minutes, sort_order)
SELECT id, name, icon, points, 30, sort FROM new_challenge,
  (VALUES
    ('Musculação', '🏋️', 10, 1),
    ('Cardio', '🏃', 8, 2),
    ('Funcional / CrossFit', '🤸', 10, 3),
    ('Yoga / Mobilidade', '🧘', 5, 4),
    ('Esporte coletivo', '⚽', 8, 5)
  ) AS t(name, icon, points, sort);
