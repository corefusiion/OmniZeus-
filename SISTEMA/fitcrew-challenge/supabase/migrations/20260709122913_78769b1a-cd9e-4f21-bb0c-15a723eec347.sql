-- Permite que um membro (não dono) saia do desafio deletando a própria linha.
DROP POLICY IF EXISTS "self can leave challenge" ON public.challenge_members;
CREATE POLICY "self can leave challenge"
ON public.challenge_members
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND role <> 'owner');