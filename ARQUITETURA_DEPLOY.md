# Guia Definitivo: Arquitetura e Deploy (Cloudflare + Supabase)

Este documento foi criado para servir de bússola para o seu SaaS. Ele descreve a arquitetura ideal recomendada, como gerenciar seus ambientes e o passo a passo para não quebrar a produção.

## 1. Arquitetura da Infraestrutura

Sua aplicação foi desmembrada para garantir segurança, velocidade e escalabilidade:

1. **Frontend (Next.js):** Hospedado no **Cloudflare Pages / Workers**.
2. **Banco de Dados (PostgreSQL):** Hospedado no **Supabase**.
3. **Gerenciamento de Pagamentos:** Stripe.
4. **LLMs e Inteligência Artificial:** OpenRouter.
5. **Integrações Externas:** Conta Azul, Evolution, LobeHub.

### Separação de Responsabilidades (Edge vs Node.js)
O Cloudflare Edge é incrível, mas possui limitações em bibliotecas pesadas de Node.js (como manipulação pesada de sistema de arquivos).
- **APIs Rápidas (Auth, Proxies de IA, Webhooks Leves):** Rodarão incrivelmente rápido na Edge da Cloudflare.
- **Banco de Dados:** Acesso direto ao Supabase usando a API REST deles ou PostgreSQL connection string (preferencialmente usando Prisma Accelerate ou Drizzle ORM, que são Edge-compatible).

---

## 2. Fluxo de Trabalho com o GitHub (Git Flow)

A regra de ouro é: **Nunca desenvolva diretamente na branch `main`.**

### Branches Necessárias
- `main`: **PRODUÇÃO.** Seu código ao vivo (app.seudominio.com). O Cloudflare apontará o domínio oficial para cá.
- `develop`: **HOMOLOGAÇÃO (Preview).** Onde todo o código novo é testado antes de ir para o ar.
- `feature/*` (ex: `feature/chat`, `feature/stripe`): **DESENVOLVIMENTO.** Branches onde você cria as novidades no seu computador (`localhost`).

### Como trabalhar no dia a dia:
1. Você quer criar um chat novo? `git checkout -b feature/chat`.
2. Terminou o chat? Faça o push e crie um **Pull Request** para a `develop`.
3. O Cloudflare vai gerar uma URL temporária (Preview) para você testar a `develop`.
4. Tudo funcionou? Aprove o Pull Request da `develop` para a `main`.
5. A `main` atualiza o site oficial sem downtime.

---

## 3. Gerenciamento de Segredos (Variáveis de Ambiente)

NUNCA, jamais, comite o arquivo `.env` ou `.env.local` para o GitHub. Seus segredos vazariam.

No ambiente de produção, você deve ir no painel do Cloudflare (Pages > Seu Projeto > Settings > Environment variables) e cadastrar as seguintes chaves:

- `DATABASE_URL` (Sua Connection String do Supabase)
- `OPENROUTER_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SESSION_SECRET` (Use uma hash forte)
- `EVOLUTION_API_KEY`
- `NEXT_PUBLIC_APP_URL` (Sua URL oficial)

*Nota: No seu PC (localhost), essas chaves ficam no arquivo `.env.local`.*

---

## 4. O Caminho para a Migração ao Supabase (PostgreSQL)

Para migrar de um banco JSON local (`omnizeus_local_sql_database.json`) para PostgreSQL, seguiremos estes passos estruturados:

1. **Escolha do ORM:** Sugerimos utilizar o **Prisma** ou **Drizzle ORM** (Drizzle é excelente para Edge/Cloudflare).
2. **Criação do Schema:** Modelaremos o banco de dados (Tabelas: Empresas, Usuários, Configurações, Logs) usando a tipagem SQL rigorosa.
3. **Refatoração das APIs:** Substituiremos as funções antigas (`readDb` e `writeDb`) pelas queries SQL do ORM.
4. **Migração de Dados (Opcional):** Um script simples para pegar os usuários de teste do seu JSON e jogar no PostgreSQL para você não perder seu ambiente de testes.

---

## 5. Próximos Passos Imediatos

1. Entregar as credenciais do **Supabase** (`DATABASE_URL`).
2. Configurar o projeto no **Cloudflare Pages** conectando com o repositório GitHub.
3. Iniciar a refatoração do banco de dados na branch `develop`.
