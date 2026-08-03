# Guia Definitivo de Deploy - Cloudflare Pages (Next.js)

Este guia documenta o processo exato para colocar o **OmniZeus** no ar usando a arquitetura serverless de ponta da Cloudflare Pages. 

---

## 1. O Pulo do Gato: Arquitetura Edge
O OmniZeus foi completamente adaptado para rodar em *Edge Computing*. Isso significa que nós removemos dependências legadas do Node.js (como a biblioteca `fs` que lia arquivos do HD) e conectamos 100% da inteligência da aplicação diretamente ao **Supabase (PostgreSQL)** através de APIs REST. Isso garante altíssima velocidade e distribuição global pela Cloudflare, sem falhas de compilação.

---

## 2. Passo a Passo do Deploy Inicial

1. Acesse o painel da sua conta na [Cloudflare](https://dash.cloudflare.com).
2. No menu lateral esquerdo, clique em **Workers & Pages**.
3. Clique no botão azul **Create Application**.
4. Selecione a aba **Pages** e clique em **Connect to Git**.
5. Autorize a conexão com o seu GitHub (caso ainda não tenha feito) e selecione o repositório **`OmniZeus-`**.
6. Clique em **Begin setup**.

---

## 3. Configurações de Compilação (Build Settings)

Na tela de setup, preencha exatamente com estes dados:

- **Project name:** `omnizeus` (ou o nome que preferir)
- **Production branch:** `main` (ou `develop` se estiver criando um ambiente de homologação/testes).
- **Framework preset:** Escolha **Next.js**.
- **Build command:** `npm run build:cf` *(script `build:cf` do `package.json` = `next-on-pages` — o adapter Next.js 14 que gera o Worker. O script `build` (`next build` puro) é usado internamente pelo adapter e para builds locais — NUNCA aponte o painel para `npm run build` puro, senão o Worker não é gerado)*.
- **Build output directory:** `.vercel/output/static` *(gerado pelo adapter; contém o `_worker.js` que é o entry-point do Worker — o `wrangler.jsonc` declara `main: ".vercel/output/static/_worker.js"`)*.

> ⚠️ **IMPORTANTE (Next.js 14)**: o projeto usa `next@14.2.15`, que NÃO é compatível com o adapter oficial atual `@opennextjs/cloudflare` (exige Next ≥15.5.21). Por isso usamos `@cloudflare/next-on-pages@1.13.15` (devDependency já instalada) + o arquivo `wrangler.jsonc` na raiz do repo, que declara `main: ".vercel/output/static/_worker.js"` e `assets.directory` — é o que faz o `wrangler versions upload` (deploy do novo fluxo Cloudflare) encontrar o entry-point. O `.npmrc` com `legacy-peer-deps=true` é necessário para o `npm clean-install` resolver o conflito de peers (wrangler/workers-types).

> ⚠️ **NÃO faça o script `build` chamar o adapter**: `next-on-pages` roda internamente `npx vercel build`, que executa o script `build` do `package.json` — se ele chamar o adapter de novo, ocorre recursão: `Error: 'vercel build' must not recursively invoke itself`. Por isso o `build` é `next build` puro e o adapter roda via `build:cf`.

> ⚠️ **NÃO use `--skip-build` no adapter**: a flag faz o `next-on-pages` pular o "Vercel build" interno, que é quem gera o `.vercel/output/config.json` — sem ele o adapter falha com `Could not read the '.vercel/output/config.json' file.` Rode o pipeline completo (`next-on-pages` sem flags).

> ⚠️ **NÃO use `pnpm` como package manager**: o projeto é configurado para **npm** (`package-lock.json` existe; `pnpm-lock.yaml` não). Rodar via pnpm faz o adapter avisar `The project is set up for npm but it is currently being run via pnpm`. Use npm (o painel detecta `npm@10.9.2` automaticamente).

---

## 4. O Passo Mais Importante: Variáveis de Ambiente (Secrets)

**ATENÇÃO:** O arquivo `.env.local` que está no seu computador local **nunca** é enviado para o GitHub por questões de segurança (ele está bloqueado no `.gitignore`). Se você não colocar essas chaves na Cloudflare, a aplicação ficará em branco ou dará erro de servidor!

1. Na mesma tela de setup, role um pouco para baixo e clique em **Environment variables (advanced)**.
2. Você precisará adicionar cada uma das variáveis do seu arquivo local. Clique em **Add variable** para cada uma delas. 

Exemplo das variáveis cruciais (pegue os valores exatos do seu `.env.local` local):
- `DATABASE_URL` = (sua string postgres)
- `SUPABASE_URL` = (sua url do supabase)
- `SUPABASE_ANON_KEY` = (sua chave anon)
- `SUPABASE_SERVICE_ROLE_KEY` = (sua chave service role)
- `JWT_SECRET` / `SESSION_SECRET` = (sua chave criptográfica)
- `SUPER_ADMIN_PASSWORD` = (senha de emergência)
- `CONTA_AZUL_CLIENT_ID` = (chave pública do app Conta Azul)
- `CONTA_AZUL_CLIENT_SECRET` = (chave secreta do app Conta Azul)

---

## 5. Lançamento!

1. Após colar as variáveis, clique em **Save and Deploy**.
2. A Cloudflare iniciará o processo (`Initializing` -> `Cloning` -> `Building` -> `Deploying`).
3. Aguarde cerca de 2 a 4 minutos.
4. Você receberá um link automático como `https://omnizeus.pages.dev`.

### E se eu precisar atualizar o projeto depois?
Basta enviar o código para o GitHub (como nós fizemos na branch `develop` ou `main`). A Cloudflare ouve o seu GitHub 24h por dia e começará um **novo build automaticamente** a cada *push*. Você não precisa fazer mais nada no painel deles!
