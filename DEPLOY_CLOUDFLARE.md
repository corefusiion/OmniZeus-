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

> ⚠️ **Edge Runtime obrigatório**: o `next-on-pages` exige `export const runtime = "edge"` em TODA rota API não-estática (senão: `Failed to produce a Cloudflare Pages build from the project. The following routes were not configured to run with the Edge Runtime`). Todas as 44 rotas do OmniZeus já estão migradas. Isso impôs a migração para **Web Crypto** (`crypto.subtle`/`getRandomValues` — HMAC de sessão, PBKDF2 de senhas, AES-GCM do at-rest, HMAC do webhook Stripe); `node:` e `Buffer` não são usados no `src/`. O `next.config.mjs` ignora imports `node:` nos bundles edge (`IgnorePlugin`) para o `pptxgenjs` (seus `import("node:fs")` dinâmicos são guardados por detecção de Node e nunca executam no edge). **Validação local confiável**: `npm run build` no Windows compila os bundles edge (`next-edge-app-route-loader`) e acusa qualquer incompatibilidade antes do push — rode `npm run build` + `npx tsc --noEmit` antes de dar push.

---

## 4. O Passo Mais Importante: Variáveis de Ambiente (Secrets)

**ATENÇÃO:** O arquivo `.env.local` que está no seu computador local **nunca** é enviado para o GitHub por questões de segurança (ele está bloqueado no `.gitignore`). Se você não colocar essas chaves na Cloudflare, a aplicação ficará em branco ou dará erro de servidor!

1. Na mesma tela de setup, role um pouco para baixo e clique em **Environment variables (advanced)**.
2. Você precisará adicionar cada uma das variáveis do seu arquivo local. Clique em **Add variable** para cada uma delas. 

**Lista COMPLETA de variáveis** (pegue os valores exatos do seu `.env.local` local; o `.env.local.example` documenta cada uma):

| Variável | Obrigatória? | Função |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL do projeto Supabase (cliente) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Chave anon do Supabase (cliente) |
| `SUPABASE_URL` | ✅ | URL do Supabase (alias servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Chave service role — usada pelo `getSupabase()` no backend |
| `SESSION_SECRET` | ✅ | Assinatura HMAC-SHA256 do cookie de sessão (mín. 32 chars) |
| `SUPER_ADMIN_PASSWORD` | ✅ | Senha de emergência do Super Admin (fallback `Design20`) |
| `OMNIZEUS_ENCRYPTION_KEY` | ✅ | Chave AES-256-GCM dos tokens Conta Azul em repouso (mín. 32 chars) |
| `OPENROUTER_API_KEY` | ✅ | Chave master OpenRouter (fallback quando a empresa não tem chave própria) |
| `CONTA_AZUL_CLIENT_ID` | 🔵 | OAuth Conta Azul (renovação de tokens) |
| `CONTA_AZUL_CLIENT_SECRET` | 🔵 | OAuth Conta Azul (renovação de tokens) |
| `STRIPE_WEBHOOK_SECRET` | 🔵 | Assinatura dos eventos do Stripe (`whsec_...`) |
| `WHATSAPP_WEBHOOK_TOKEN` | 🔵 | Token compartilhado da Evolution API |
| `NEXT_PUBLIC_APP_URL` | 🔵 | URL pública da aplicação (callbacks/redirects) |
| `DATABASE_URL` | ❌ | Apenas para scripts locais (drizzle); o app usa Supabase REST |

> ⚠️ **Gere `SESSION_SECRET` e `OMNIZEUS_ENCRYPTION_KEY` com valores novos** (não reutilize os do dev local se possível):
> ```
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
> ```
> Sem `OMNIZEUS_ENCRYPTION_KEY` em produção, qualquer gravação de token Conta Azul lança erro no runtime (`Encryption key missing`).

---

## 5. Lançamento!

1. Após colar as variáveis, clique em **Save and Deploy**.
2. A Cloudflare iniciará o processo (`Initializing` -> `Cloning` -> `Building` -> `Deploying`).
3. Aguarde cerca de 2 a 4 minutos.
4. Você receberá um link automático como `https://omnizeus.pages.dev`.

### E se eu precisar atualizar o projeto depois?
Basta enviar o código para o GitHub (como nós fizemos na branch `develop` ou `main`). A Cloudflare ouve o seu GitHub 24h por dia e começará um **novo build automaticamente** a cada *push*. Você não precisa fazer mais nada no painel deles!
