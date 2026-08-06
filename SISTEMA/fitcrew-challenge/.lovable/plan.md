# Plano: Viralização + Retenção

Três frentes independentes. Vou implementar em ordem, testando cada uma.

## 1) Landing pública de convite `/invite/:code`

Já existem: `challenges.invite_code`, `invite_enabled`, RPC `get_challenge_by_invite`, RPC `join_challenge_by_invite`, e leaderboard `leaderboard_top_v1`. Aproveitamos tudo.

**Novo arquivo:** `src/routes/invite.$code.tsx` (rota pública, SSR).
- Loader chama server fn `getInvitePreview({ code })` que usa client publishable (server) para:
  - `get_challenge_by_invite(code)` → nome, datas, ativo
  - Buscar `challenges.banner_url`, `owner_id`
  - `leaderboard_top_v1(challenge_id, 3)` → pódio
- UI: banner do desafio, título "Você foi convocado para a Crew: X", pódio 🥇🥈🥉 com avatar/nome/pontos, frase de gatilho, contagem regressiva/status via `describeChallengeWindow`.
- CTA "Aceitar Desafio (Criar Conta)" → `/auth?invite=CODE` (persistir no sessionStorage também).
- `head()` com OG title/description/imagem = banner do desafio (viraliza em WhatsApp).

**Auto-join após login:**
- Em `src/routes/auth.tsx`, ler `?invite=` (ou sessionStorage) após login sucesso, chamar RPC `join_challenge_by_invite` e redirecionar para `/c/:id`.
- Já existe fluxo similar em `join.$code.tsx` — refatorar para reaproveitar.

**Grants:** `get_challenge_by_invite` e `leaderboard_top_v1` são SECURITY DEFINER → ok chamar via server publishable client.

## 2) Compartilhar Vitória (imagem para stories)

**Dependência:** `bun add html-to-image` (leve, ~15KB, mais confiável que html2canvas em stack React moderna).

**Novo componente:** `src/components/share/share-victory-card.tsx`
- Card 1080x1920 (proporção story), renderizado off-screen absoluto.
- Contém: logo FitCrew, nome do desafio, avatar + display_name, posição ranking ("Estou em 1º Lugar!"), pontos, foto opcional (check-in), rodapé "Bata de frente comigo no app FitCrew · fitcrew.lovable.app".
- Design agressivo: gradient primário, tipografia display grande.

**Novo hook:** `src/lib/share-image.ts` — `renderAndShare({ ref, filename })`:
- `toBlob(node)` → File
- Se `navigator.canShare({ files })` → `navigator.share({ files, title, text })`
- Senão fallback: download PNG.

**Integração:**
- Página de ranking `_authenticated/ranking.tsx` e `c.$id.ranking.tsx`: botão "📸 Compartilhar Vitória" no topo para o usuário logado (pega posição/pontos dele nos rows).
- Após check-in bem-sucedido em `checkin.tsx`: toast com ação "Compartilhar".

## 3) Duelos 1v1 semanais

**Já existe muita coisa:** tabela `duels` (16 cols), server fns `createDuel`/`respondDuel`/`listDuelsForChallenge`, componente `duel-invite-modal.tsx`, rota `c.$id.duels.tsx`, banner `pending-duels-banner.tsx`, notificações. O que falta:

**Ranking → Duelo:**
- Em `c.$id.ranking.tsx`, ao clicar em outro usuário abrir modal com opção "⚔️ Desafiar para Duelo" (usa `DuelInviteModal` existente). Verificar se já tem — se não, adicionar botão inline nos rows.

**Duração 7 dias (não semanal fixa):**
- `duels.functions.ts` atualmente usa `week_start` = segunda da semana atual. Ajustar para: se aceito, `start_date = accepted_at`, `end_date = accepted_at + 7 days`. Adicionar colunas `start_date/end_date` se não existirem (a tabela já tem 16 colunas — verificar).
- Migration só se as colunas não existirem; caso contrário só código.

**Resolução automática:**
- Server fn `resolveExpiredDuels` já existe (verificar) ou criar. Chamada no loader de `c.$id.duels.tsx` para lazy-resolve. Calcula pontos de cada um no período (checkins.points_awarded onde occurred_on between start/end).
- Vencedor → badge `duel_winner` via `award_badge`.

**Badge no ranking:**
- Já existe `user_badges`. Adicionar seed do badge `duel_winner` (troféu ⚔️).
- Em `c.$id.ranking.tsx` e `ranking.tsx`, buscar contagem de `duel_winner` por user_id do desafio e exibir ⚔️xN ao lado do nome.

## Etapas de execução

1. Migration: seed badge `duel_winner`, garantir colunas `start_date/end_date` em `duels` (verificar antes).
2. Backend: server fn `getInvitePreview` + refactor de duels para 7 dias + `resolveDuel`.
3. Frontend: rota `/invite/$code`, auto-join no auth, share card + hook, botão duelo no ranking, badge ⚔️ inline.
4. Verificação: tsgo + smoke test navegando em `/invite/CODIGO`.

## Detalhes técnicos

- `html-to-image` funciona em SSR? Só carregar client-side (`await import` dentro do handler do botão) — evita quebrar build.
- Rota `/invite/$code` é pública, então usa server publishable client (não `requireSupabaseAuth`), respeitando `tanstack-supabase-integration`.
- `og:image` só no leaf `invite.$code.tsx`, não no `__root`.
- Sem novas Edge Functions — tudo via `createServerFn`.
