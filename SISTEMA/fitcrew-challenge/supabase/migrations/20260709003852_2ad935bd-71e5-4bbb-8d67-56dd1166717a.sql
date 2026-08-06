
CREATE TABLE IF NOT EXISTS public.banned_words (
  word text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  severity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banned_words TO authenticated;
GRANT ALL ON public.banned_words TO service_role;

ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banned_words_read_authenticated" ON public.banned_words;
CREATE POLICY "banned_words_read_authenticated"
  ON public.banned_words FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "banned_words_admin_write" ON public.banned_words;
CREATE POLICY "banned_words_admin_write"
  ON public.banned_words FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS flagged_terms text[] NULL;

ALTER TABLE public.checkin_comments
  ADD COLUMN IF NOT EXISTS flagged_terms text[] NULL;

CREATE TABLE IF NOT EXISTS public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('post_comment','checkin_comment','post')),
  source_id uuid NOT NULL,
  terms text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_warnings_user_idx ON public.user_warnings(user_id, created_at DESC);

GRANT SELECT ON public.user_warnings TO authenticated;
GRANT ALL ON public.user_warnings TO service_role;

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_warnings_self_read" ON public.user_warnings;
CREATE POLICY "user_warnings_self_read"
  ON public.user_warnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_warnings_admin_write" ON public.user_warnings;
CREATE POLICY "user_warnings_admin_write"
  ON public.user_warnings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.banned_words (word) VALUES
  ('porra'),('caralho'),('merda'),('bosta'),('foda-se'),('fodase'),
  ('vagabundo'),('vagabunda'),('viado'),('viada'),('bicha'),
  ('cuzao'),('cuzão'),('otario'),('otário'),('otaria'),('otária'),
  ('idiota'),('imbecil'),('retardado'),('retardada'),('babaca'),
  ('arrombado'),('arrombada'),('desgracado'),('desgraçado'),
  ('puta'),('puto'),('piranha'),('cornao'),('cornão'),
  ('escroto'),('escrota'),('nojento'),('nojenta')
ON CONFLICT (word) DO NOTHING;
