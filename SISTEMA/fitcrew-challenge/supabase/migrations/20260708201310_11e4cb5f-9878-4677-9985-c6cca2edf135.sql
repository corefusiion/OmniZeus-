
-- 1. Novos campos em challenges
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_enabled boolean NOT NULL DEFAULT true;

-- Semeia owner_id a partir de created_by, ou do primeiro admin global
UPDATE public.challenges c
SET owner_id = COALESCE(
  c.created_by,
  (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1)
)
WHERE c.owner_id IS NULL;

-- Gera invite_code onde falta (8 chars alfanuméricos)
UPDATE public.challenges
SET invite_code = substr(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), 1, 8)
WHERE invite_code IS NULL;

-- 2. Tabela challenge_members
CREATE TABLE IF NOT EXISTS public.challenge_members (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','co_admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_members TO authenticated;
GRANT ALL ON public.challenge_members TO service_role;

ALTER TABLE public.challenge_members ENABLE ROW LEVEL SECURITY;

-- 3. Funções de permissão (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_challenge_admin(_user_id uuid, _challenge_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.challenges WHERE id = _challenge_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.challenge_members
    WHERE challenge_id = _challenge_id AND user_id = _user_id AND role IN ('owner','co_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_challenge_member(_user_id uuid, _challenge_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.challenges WHERE id = _challenge_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.challenge_members
    WHERE challenge_id = _challenge_id AND user_id = _user_id
  );
$$;

-- 4. Seed: dono do desafio existente vira 'owner'; todos usuários com checkins ou perfil viram 'member'
INSERT INTO public.challenge_members (challenge_id, user_id, role, joined_at)
SELECT c.id, c.owner_id, 'owner', c.created_at
FROM public.challenges c
WHERE c.owner_id IS NOT NULL
ON CONFLICT (challenge_id, user_id) DO UPDATE SET role = 'owner';

-- todo perfil existente entra como membro do desafio ativo (backfill leve)
INSERT INTO public.challenge_members (challenge_id, user_id, role)
SELECT c.id, p.id, 'member'
FROM public.profiles p
CROSS JOIN LATERAL (SELECT id, owner_id FROM public.challenges WHERE is_active = true ORDER BY starts_at DESC LIMIT 1) c
WHERE c.id IS NOT NULL AND p.id <> COALESCE(c.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
ON CONFLICT DO NOTHING;

-- 5. Adiciona challenge_id em posts (nullable — backfill do desafio ativo)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE;

UPDATE public.posts p
SET challenge_id = c.id
FROM (SELECT id FROM public.challenges WHERE is_active = true ORDER BY starts_at DESC LIMIT 1) c
WHERE p.challenge_id IS NULL;

CREATE INDEX IF NOT EXISTS posts_challenge_id_idx ON public.posts(challenge_id);

-- 6. RLS de challenge_members
DROP POLICY IF EXISTS "members read own challenges" ON public.challenge_members;
CREATE POLICY "members read own challenges"
ON public.challenge_members
FOR SELECT TO authenticated
USING (public.is_challenge_member(auth.uid(), challenge_id));

DROP POLICY IF EXISTS "admins manage members" ON public.challenge_members;
CREATE POLICY "admins manage members"
ON public.challenge_members
FOR ALL TO authenticated
USING (public.is_challenge_admin(auth.uid(), challenge_id))
WITH CHECK (public.is_challenge_admin(auth.uid(), challenge_id));

DROP POLICY IF EXISTS "self can join via server fn" ON public.challenge_members;
CREATE POLICY "self insert as member"
ON public.challenge_members
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'member');

-- 7. RLS de challenges: convite público (anon) lê só desafios com invite_enabled=true
DROP POLICY IF EXISTS "Challenges viewable by authenticated" ON public.challenges;
CREATE POLICY "challenges visible to members"
ON public.challenges
FOR SELECT TO authenticated
USING (public.is_challenge_member(auth.uid(), id) OR is_active = true);

DROP POLICY IF EXISTS "public invite lookup" ON public.challenges;
CREATE POLICY "public invite lookup"
ON public.challenges
FOR SELECT TO anon
USING (invite_enabled = true AND invite_code IS NOT NULL);

GRANT SELECT ON public.challenges TO anon;

-- Qualquer usuário autenticado pode criar seu próprio desafio
DROP POLICY IF EXISTS "authenticated create own challenge" ON public.challenges;
CREATE POLICY "authenticated create own challenge"
ON public.challenges
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Update passa a ser challenge-admin scoped (o global admin já entra via has_role dentro da função)
DROP POLICY IF EXISTS "challenges_admin_update" ON public.challenges;
DROP POLICY IF EXISTS "Admins manage challenges" ON public.challenges;
CREATE POLICY "challenge admins update"
ON public.challenges
FOR UPDATE TO authenticated
USING (public.is_challenge_admin(auth.uid(), id))
WITH CHECK (public.is_challenge_admin(auth.uid(), id));

CREATE POLICY "owner deletes challenge"
ON public.challenges
FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- 8. RLS: exercise_types passa a exigir admin do desafio para escrita e ser membro para leitura
DROP POLICY IF EXISTS "Admins manage exercise types" ON public.exercise_types;
DROP POLICY IF EXISTS "Exercise types viewable" ON public.exercise_types;
CREATE POLICY "exercise_types read by members"
ON public.exercise_types FOR SELECT TO authenticated
USING (public.is_challenge_member(auth.uid(), challenge_id));
CREATE POLICY "exercise_types write by challenge admin"
ON public.exercise_types FOR ALL TO authenticated
USING (public.is_challenge_admin(auth.uid(), challenge_id))
WITH CHECK (public.is_challenge_admin(auth.uid(), challenge_id));

-- 9. RLS: challenge_participants — só admin do desafio escreve, membro do desafio lê
DROP POLICY IF EXISTS "participants_admin_write" ON public.challenge_participants;
DROP POLICY IF EXISTS "participants_select_all_auth" ON public.challenge_participants;
CREATE POLICY "participants read by members"
ON public.challenge_participants FOR SELECT TO authenticated
USING (public.is_challenge_member(auth.uid(), challenge_id));
CREATE POLICY "participants write by challenge admin"
ON public.challenge_participants FOR ALL TO authenticated
USING (public.is_challenge_admin(auth.uid(), challenge_id))
WITH CHECK (public.is_challenge_admin(auth.uid(), challenge_id));

-- 10. RLS: checkins — leitura por membros, escrita própria se membro, update/delete por próprio ou admin do desafio
DROP POLICY IF EXISTS "Checkins viewable by authenticated" ON public.checkins;
DROP POLICY IF EXISTS "Users insert own checkins" ON public.checkins;
DROP POLICY IF EXISTS "Users update own or admin checkins" ON public.checkins;
DROP POLICY IF EXISTS "Users delete own or admin" ON public.checkins;

CREATE POLICY "checkins read by members"
ON public.checkins FOR SELECT TO authenticated
USING (public.is_challenge_member(auth.uid(), challenge_id));

CREATE POLICY "checkins insert own if member"
ON public.checkins FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_challenge_member(auth.uid(), challenge_id));

CREATE POLICY "checkins update own or admin"
ON public.checkins FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_challenge_admin(auth.uid(), challenge_id))
WITH CHECK (auth.uid() = user_id OR public.is_challenge_admin(auth.uid(), challenge_id));

CREATE POLICY "checkins delete own or admin"
ON public.checkins FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_challenge_admin(auth.uid(), challenge_id));

-- 11. RLS: posts — mesma coisa (já tem challenge_id agora)
DROP POLICY IF EXISTS "posts: read for authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts: insert own" ON public.posts;
DROP POLICY IF EXISTS "posts: update own or admin" ON public.posts;
DROP POLICY IF EXISTS "posts: delete own or admin" ON public.posts;

CREATE POLICY "posts read by members"
ON public.posts FOR SELECT TO authenticated
USING (challenge_id IS NULL OR public.is_challenge_member(auth.uid(), challenge_id));

CREATE POLICY "posts insert own if member"
ON public.posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (challenge_id IS NULL OR public.is_challenge_member(auth.uid(), challenge_id)));

CREATE POLICY "posts update own or admin"
ON public.posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR (challenge_id IS NOT NULL AND public.is_challenge_admin(auth.uid(), challenge_id)))
WITH CHECK (auth.uid() = user_id OR (challenge_id IS NOT NULL AND public.is_challenge_admin(auth.uid(), challenge_id)));

CREATE POLICY "posts delete own or admin"
ON public.posts FOR DELETE TO authenticated
USING (auth.uid() = user_id OR (challenge_id IS NOT NULL AND public.is_challenge_admin(auth.uid(), challenge_id)));
