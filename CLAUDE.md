# OmniZeus — Technical Architecture & Onboarding Guide (Claude AI)

> **Anthropic / Claude Technical Guide**: This document summarizes the technical stack, state management, security boundaries, file paths, and conversation logs of **OmniZeus** for fast onboarding across model switches or new development environments.

---

## 🛠️ Key Technical Specifications

- **Framework**: Next.js 14 (App Router Edge & Client Components)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + Custom CSS Utilities (`#1E6FD9`, `#0F172A`, `#F8FAFC`, `#E2E8F0`)
- **Icons**: Lucide React (`strokeWidth={1.5}`)
- **Charts**: Recharts (`AreaChart`, `BarChart`, `PieChart`, `ResponsiveContainer`)
- **PDF Generation**: Native A4 Print Styles & Browser Window Exporter
- **WhatsApp Integration**: Evolution API Webhook (`/api/whatsapp/webhook`) & Base64 QR Code renderer
- **Conta Azul ERP Integration**: Auto-sync engine (`/api/contaazul/auto-sync`), DRE mapping, and AI Workspace
- **Stripe Subscriptions & Webhook**: Stripe Checkout (`/api/checkout/create-session`), Customer Portal (`/api/checkout/customer-portal`), and Webhook processor (`/api/webhook/stripe`)

---

## 🔒 Security & Multi-Tenant Role Engine

Located in `src/lib/auth/roles.ts`, `src/app/api/auth/me/route.ts`, and `src/app/api/db/route.ts`:
- `UserRole = 'super_adm' | 'gestor' | 'funcionario'`
- **Session Rehydration**: Server-side endpoint `GET /api/auth/me` decodes the `omnizeus_session` HttpOnly cookie on app mount.
- **Top Company Selector (`Header.tsx`)**: Rendered **exclusively** for `super_adm` users. Completely hidden from `gestor` and `funcionario` users.
- **Server-side Anti-Cross Tenant Guard (`/api/db`)**: Requests with a `company_id` mismatching the caller's session `companyId` return **`403 Forbidden`**.

---

## 🪙 Internal Currency & API Proxy Architecture

Located in `src/lib/coins/store.ts` and `src/app/api/chat/route.ts`:
1. Customers pay for **OmniCoins** (1 Coin = R$ 0.10).
2. The Edge runtime route `/api/chat` proxies calls to **OpenRouter API** (`https://openrouter.ai/api/v1/chat/completions`).
3. OpenRouter canonical models mapped directly: `openai/gpt-4o`, `anthropic/claude-3.7-sonnet`, `google/gemini-2.5-pro`, `deepseek/deepseek-r1`, `moonshotai/moonshot-v1-128k`.
4. OpenRouter API Key and real USD costs are hidden from clients and managed strictly via the Super ADM panel (`/super-adm`).

---

## 🧪 Test Credentials (Multi-Tenant Seed)

- 👑 **Super Admin Master:** `jsgleisson@gmail.com` / `Design20`
- 🛡️ **Gestor Alpha:** `gestor_alpha@teste-alpha.local` / `Design20`
- 👤 **Funcionário Alpha:** `funcionario02@teste-alpha.local` / `Design20`
- 🛡️ **Gestor Beta:** `gestor_beta@teste-beta.local` / `Design20`
- 🛡️ **Gestor Gamma:** `gestor_gamma@teste-gamma.local` / `Design20`

---

## 📍 Conversation Log & Trajectory Paths

To inspect or resume the conversation history for this workspace:

- **Conversation ID**: `f6b6bace-f6b2-486e-aa67-66ad81d63ca2`
- **Compact Log (JSONL)**:
  `C:\Users\t034183\.gemini\antigravity\brain\f6b6bace-f6b2-486e-aa67-66ad81d63ca2\.system_generated\logs\transcript.jsonl`
- **Full Untruncated Log**:
  `C:\Users\t034183\.gemini\antigravity\brain\f6b6bace-f6b2-486e-aa67-66ad81d63ca2\.system_generated\logs\transcript_full.jsonl`

---

## 🚀 Quick Command Reference

```bash
# Start development server
npm run dev

# Re-seed test multi-tenant database
node scripts/execute-controlled-multitenant-test.js

# Production build validation
npm run build
```

---

## 🧭 Log de Continuidade de Sessão

> **Objetivo**: registro vivo de onde paramos, para retomar o trabalho mesmo se a conexão cair ou ao trocar de PC. Claude atualiza esta seção ao longo da conversa.

### Sessão atual — 2026-08-01

**Status geral:** Implementação da **refatoração Multi-Tenant SaaS** em andamento. Duas frentes: (a) isolamento completo do ambiente Super ADM (plataforma) vs Empresas/Tenants via `TenantContext` + `getActiveTenantId()`; (b) novo **Dashboard Master SaaS** (`/dashboard-master`).

**Onde paramos (ordem de trabalho Multi-Tenant):**
1. ✅ **Mapeamento da arquitetura** — sessão, contexto, rotas, stores, API `/api/db`, cache (SWR/localStorage).
2. ✅ **`src/lib/auth/roles.ts`** — `activeTenantContextId` agora `string | null` (null = SaaS); `getActiveTenantId()` / `isInTenantMode()`; `setActiveCompanyContext` aceita null, limpa localStorage e dispara eventos.
3. ✅ **`invalidateSwrCache()`** em `src/lib/cache/swrCache.ts`; resets adicionados: `resetCoinStore`, `resetCompanyStore`, `resetTaskStore`, `resetSqliteDb`.
4. ✅ **`src/lib/tenant/TenantContext.tsx`** (novo) — `TenantProvider`/`useTenant()`: `tenantId`, `activeCompany`, `isSaaSMode`, `isTenantMode`, `canSwitchCompany`, `enterTenant`, `exitTenant`, `refresh`; troca de empresa faz reset total de stores + `router.push("/dashboard")`.
5. ✅ **`src/components/layout/Header.tsx`** — seletor profissional (dropdown), modal "Você está entrando na empresa", banner fixo "Você está administrando: [Empresa]" + "Sair da Empresa" (só Super ADM em modo tenant), badge para não-super-admins.
6. ✅ **`src/app/(dashboard)/layout.tsx`** — envolto em `TenantProvider`; `main` usa `pt-[92px]` quando banner ativo (senão `pt-16`); telas de empresa suspensa / grace period preservadas.
7. ✅ **`src/app/(dashboard)/dashboard-master/page.tsx`** (NOVO) — **Dashboard Master SaaS**: KPIs reais (MRR ativo, empresas por status/plano, usuários/gestores/funcionários, coins consumidas, custo IA mês/hoje, lucro líquido, requisições e tokens), alertas da plataforma (empresa suspensa, Stripe inadimplente, franquia esgotada, chave OpenRouter com erro, webhook parado, Conta Azul desconectada), gráficos (consumo por modelo BarChart, por hub PieChart, top agentes), painel OmniCoins (distribuídas/consumidas/restantes + barra de consumo), lucro líquido (Stripe − OpenRouter − infraestrutura), crescimento (novas/churn/retenção + evolução mensal), rankings (maior consumo e mais lucrativas) e tabela de inadimplentes. **Zero mock** — tudo consumido de `companies`, `employees`, `ai_usage_logs`, `settings` e `contaazul_config` via `/api/db` (super_adm+global retorna tudo). Custo IA estimado pela conversão interna (1 coin = R$ 0,10).
8. ✅ **`src/components/layout/Sidebar.tsx`** — grupo "Master SaaS" aparece só para Super ADM em modo SaaS (`isSaaSMode`); em modo tenant mostra apenas o item Dashboard Master; gestor/funcionário nunca veem grupo Master.
9. ✅ **Validação de tipos** — `npx tsc --noEmit` passou (exit 0).
10. ✅ **Auditoria de isolamento de dados (páginas de tenant)** — removidos todos os fallbacks hardcoded de tenant (`comp_zenitus`/`default_company`/`default_tenant`) em páginas operacionais:
    - `omni-ia/page.tsx`: saldo de coins usa `getActiveTenantId()` em vez de `"comp_zenitus"`; sem tenant ativo, bloqueia envio (modal sem coins).
    - `estatisticas-ia/page.tsx`: `activeCompany` agora resolve pelo `getActiveTenantId()` (não mais `getCompanies()[0]`); filtro de logs por tenant real.
    - `contaazul/page.tsx`: BPO chat (`/api/bpo-chat/conversations` GET/POST) e auto-sync enviam `company_id` do tenant ativo (não mais `default_company`/`comp_zenitus`).
    - `tarefas/page.tsx`: nova task e normalização usam `getActiveTenantId()`; seed morto `DEFAULT_TASKS` com `company_id` vazio.
    - Sobrou apenas o fallback benigno na página SaaS `empresas` (filtro de conversas por `selectedTenant.id`, `comp_zenitus` é empresa real no seed).
11. ✅ **`dashboard-master/page.tsx`** — leitura forçada com `company_id='global'` explícito (via `fetchServerTable(..., 'global')`), nunca herda tenant residual do localStorage.
12. ✅ **Validação de tipos** — `npx tsc --noEmit` passou (exit 0) após auditoria.
13. ✅ **`src/lib/coins/store.ts`** — `getCoinBalance()`/`deductCoins()`/`addCoins()` sem companyId agora resolvem via `localStorage.omnizeus_active_company_id` (fallback `comp_zenitus` apenas como último recurso), eliminando leitura/débito de coins de empresa errada em páginas de tenant. Header não consome mais o store de coins.
14. ✅ **BUG CRÍTICO CORRIGIDO — "Relogin cai no modo empresa"** (2026-08-01): após logout+login, o Super ADM aparecia como empresa com dashboard antigo acumulado. **Causa raiz**: `TenantProvider` computava `isTenantMode`/`canSwitchCompany` de `getActiveRole()` a cada render, mas só re-renderizava quando `tenantId` mudava; no 1º render a role ainda era `'funcionario'` (default) → `isInTenantMode()=true`; após `rehydrateSession` setar super_adm, `getActiveTenantId()` continuava `null` → `setTenantId(null)` com o MESMO valor → React não re-renderiza → estado congelado em modo empresa. **Fix**: `TenantProvider` mantém `role` em `useState` re-sincronizado via eventos `omnizeus_role_change`/`user_change`/`company_context_change`; `setCurrentUser` preserva tenant persistido em localStorage (F5 dentro da empresa não expulsa); login page chama `setActiveCompanyContext(null)` para super_adm (todo login novo começa em SaaS). **Validação E2E** (playwright headless): 1º login → `/dashboard-master` (SaaS, sidebar Master); relogin → idem; entrar empresa → `/dashboard` (sidebar tenant + banner); Sair da Empresa → `/dashboard-master`; F5 dentro da empresa mantém tenant; super_adm SaaS acessando `/omni-ia` → redireciona `/dashboard-master`; gestor → `/dashboard` sem Dashboard Master. `npx tsc --noEmit` passou (exit 0).
15. ✅ **BUG CORRIGIDO — "Flash de Acesso Estritamente Negado / tenta entrar como empresa" antes do `/dashboard-master`** (2026-08-01): ao logar, o Super ADM via uma tela vermelha "Acesso Estritamente Negado" (~2s) e o sidebar/header de empresa antes de cair no lugar certo. **Causa raiz (2 fontes)**:
    - `dashboard-master` e `super-adm` inicializavam `role` com um default (`"gestor"`/`"funcionario"`); no 1º render (antes de `rehydrateSession`) o guard `role !== "super_adm"` renderizava "Acesso Estritamente Negado".
    - `TenantContext.isTenantMode` vinha de `isInTenantMode()` (lê o role default `'funcionario'` do módulo) → retornava `true` no 1º render → o guard do `layout.tsx` redirecionava `/dashboard-master` → `/dashboard` (modo empresa) até a reidratação corrigir.
    - **Fix**: (a) `dashboard-master` e `super-adm` usam `role = useState<UserRole | null>(null)` e renderizam "Carregando sessão..." enquanto `null`; só aplicam o role quando `getCurrentUser().id` existe (navegação client-side) ou via evento `omnizeus_role_change`. (b) `TenantContext`: `role` inicia `null` (só aplica se sessão reidratada no mount), `isTenantMode` agora é derivado dos states reais (`role===null → false`, `super_adm → tenantId!==null`, senão `true`) — nunca do role default. (c) `Sidebar`: `role` inicia `null`, `showSaaS` exige `role!==null`, e com `role===null` mostra sidebar vazio (sem menu de empresa). (d) `Header`: `sessionResolved = Boolean(currentUser.id)`; seletor de workspace e badge de role só renderizam após reidratar (placeholder "Carregando sessão..."). `npx tsc --noEmit` passou (exit 0).
16. ✅ **BUG CORRIGIDO — "Criar Usuário via Painel Master salva com company_id errado"** (2026-08-01): o encarte "Criar Usuário (Gestor ou Funcionário)" do `/super-adm` cria o funcionário mas, com o Super ADM em modo SaaS, o insert em `employees` gravava `company_id = "global"` em vez da empresa destino (o route `/api/db` sobrescreve `record.company_id = effectiveCompanyId`; `employees` não está em `GLOBAL_TABLES`). **Fix**: `saveEmployee` em `src/lib/company/store.ts` agora passa `newEmp.companyId` como 3º argumento do `insertServerTable` → header `x-company-id` = empresa destino → `effectiveCompanyId` correto. `npx tsc --noEmit` passou (exit 0).
17. ✅ **MELHORIA — Painel Master "Criar Usuário" agora exibe modal de senha temporária** (2026-08-01): ao criar gestor/funcionário pelo `/super-adm`, o sistema gera senha temporária aleatória (`generateTemporaryPassword`), armazena o **hash** (`hashPassword`), salva com `status: 'Primeiro acesso pendente'` + `mustChangePassword: true`, e abre o **modal profissional "Senha Temporária Gerada para Cadastro"** (mesmo padrão do menu Usuários & Equipe) com botão "Copiar". Senha em texto puro só aparece ao Super ADM; nunca é persistida. `npx tsc --noEmit` passou (exit 0).
18. ✅ **MELHORIA — "Cadastro em Lote" de colaboradores via CSV** (2026-08-01): novo componente reutilizável `src/components/employees/BatchUserUpload.tsx` com link minimalista "Cadastro em lote" no cabeçalho do card de cadastro, usado nos DOIS lugares: menu **Usuários & Equipe** (gestor) e encarte **Criar Usuário do Painel Master Super ADM**. Abre modal com: (a) download de modelo CSV (`nome;email;cargo;funcao`), (b) upload por clique ou drag-and-drop, (c) parser CSV que detecta separador `;`/`,` e trata aspas, (d) limite de **10 usuários por lote**, (e) preview dos registros com badge GESTOR/FUNCIONÁRIO e marcação de erro, (f) cadastro em sequência com senha temporária hashada + `mustChangePassword`, (g) modal de resultado listando todas as senhas com botão "Copiar Todas as Senhas". `npx tsc --noEmit` passou (exit 0).
19. ✅ **BUG CORRIGIDO — "Rendered fewer hooks than expected" em /estatisticas-ia** (2026-08-01): crash ao acessar a página como funcionário (usuário confirmou "funcionou"). **Causa raiz**: o guard `if (role === "funcionario") return` ficava na antiga linha 105 — DEPOIS dos `useState`/`useEffect`, mas ANTES de 7 hooks (`useMemo` em 115/120/162/210/305/323 + `useEffect` em 318). 1º render com `role="gestor"` rodava todos os hooks; após `setRole(getActiveRole())` → `"funcionario"`, o re-render retornava cedo pulando hooks → "Rendered fewer hooks than expected". **Fix**: guard movido para a linha 320 (após todos os hooks, antes do `return` final). `omni-ia:123`, `super-adm:109` e guards do `DynamicTable.tsx` eram early returns DENTRO de callbacks/helpers (não bugs). `npx tsc --noEmit` passou (exit 0).
20. ✅ **LIMPEZA DO SIDEBAR SaaS — itens duplicados removidos** (2026-08-01): `Sidebar.tsx:348` usa `isActive = pathname === item.href`, então itens com a MESMA rota acendiam todos juntos (11 itens duplicados para 3 rotas): `/empresas` (2 itens: "Centro de Comando Multi-Finance" + "Empresas"), `/dashboard-master` (4 itens: Dashboard Master + Receita MRR & Lucro + Consumo Global OpenRouter + Consumo de Coins — a página é UMA sem abas e já contém tudo), `/super-adm` (6 itens, sendo 4 atalhos para a aba `infraestrutura` que já contém OpenRouter Master/Endpoint/Evolution/LobeHub/Stripe). **Fix**: removidos "Empresas", "Receita MRR & Lucro", "Consumo Global OpenRouter", "Consumo de Coins" e os grupos "Integrações & APIs" e "Configurações" (duplicavam a aba `infraestrutura`); importações não usadas removidas (`Layers`, `PenTool`, `Share2`, `TrendingUp`, `Coins`) e chaves `saas-infra`/`saas-config` tiradas do estado de accordion. Cada rota agora tem UM item no sidebar. `npx tsc --noEmit` passou (exit 0).
21. ✅ **FEATURE — "Permissão por Módulos" agora realmente restringe o menu do funcionário** (2026-08-01): o `allowedModules` era salvo/exibido mas **nunca aplicado** (nenhum componente consumia para filtrar menus/rotas). **Fix em 5 pontos**: (a) `UserProfile` em `src/lib/auth/roles.ts` ganhou `allowedModules?: string[]` + helper `getAllowedModules()`; (b) `SessionPayload` em `session.ts` ganhou `allowedModules?: string[]` (cookie agora carrega os módulos); (c) `POST /api/auth/login` grava `allowedModules` no cookie; (d) `GET /api/auth/me` devolve `allowedModules` na reidratação (F5 preserva); (e) `Sidebar.tsx` — cada item de tenant ganhou campo `module` (ex.: `/omni-ia`→`omni-ia`, `/financeiro`/`/contratos`/`/solicitacoes`→`financeiro`, `/contaazul`→`contaazul`, `/tarefas`→`tarefas`, `/documentos`→`documentos`, `/apresentacoes`→`apresentacoes`, `/omni-contaazul-ia`→`contaazul`, `/treinar-agente`+`/estatisticas-ia`→`omni-ia`) e para `funcionario` o menu é filtrado por `allowedModules` (grupos sem itens são removidos). Dashboard Executivo + Central de Notificações não têm módulo → sempre visíveis; gestor/super_adm veem tudo (não são filtrados). **Atenção**: o funcionário precisa **refazer login** para a sessão ganhar `allowedModules` no cookie (sessões antigas não tinham). `npx tsc --noEmit` passou (exit 0).
22. ✅ **ANÁLISE DO PAINEL SUPER ADM — Pedidos de Compra, FinOps & sincronização** (2026-08-01): mapeado fluxo completo de pedidos (provisão em `super-adm/page.tsx:325`, webhook Stripe com HMAC, `create-session` com planos no servidor) e "Centro Master de Medição & Economia de IA" (`finOpsData` real de `ai_usage_logs`; config de chave por empresa salva/testada ao vivo em `POST /api/openrouter/company/save`). **Achados**: (a) provisão liberada mesmo com `PENDENTE_PAGAMENTO` (empresa `Ativo` + `subscription_status:'incomplete'` entrava no MRR, que conta por `status`); (b) **não existia forma de excluir pedido**; (c) `POST /api/test/ai-simulation` ("100 Chamadas Reais") era **simulação sintética** que poluía `ai_usage_logs` (funcionalidade "Validação Teste IA", coins/custo fabricados, company_id `comp_zenitus`); (d) **fluxos Conta Azul IA que ignoravam a chave da empresa**: `contaazul/ia-workspace/route.ts` e `ia-workspace/import/route.ts` usavam `dbSettings.openrouter_api_key || process.env.OPENROUTER_API_KEY` (master) diretamente, sem `resolveAIProvider`. Fluxos que JÁ usavam `executeAIRequest`/`resolveAIProvider` corretamente: `/api/chat`, `/api/agents/improve`, `/api/bpo-chat/messages`, `/api/contaazul/ai-assistant`. Modelos futuristas do frontend (gpt-5.5 etc.) só funcionavam via `MODEL_MAP` (ia-workspace não mapeava). `npx tsc --noEmit` passou (exit 0).
23. ✅ **CORREÇÃO — Chave OpenRouter por empresa agora vale para TODOS os agentes Conta Azul IA** (2026-08-01): `src/app/api/contaazul/ia-workspace/route.ts` e `ia-workspace/import/route.ts` (OCR/vision) trocaram a leitura direta da chave master por `resolveAIProvider({companyId, userRole, requestedModel})` + `MODEL_MAP` (exportado de `openRouterClient.ts`) — prioriza a chave da empresa configurada no Centro Master, com fallback master. companyId vem do header `x-company-id` → body → sessão; frontend `omni-contaazul-ia/page.tsx` agora envia `x-company-id: getActiveTenantId()` nos 2 fetches. Audit log do workspace usa `session.userId` + `activeCompanyId` reais (não mais hardcoded `super_adm`/`comp_zenitus`). Sem débito duplo de coins (o cliente já desconta 5/10 coins via `deductCoins`). `npx tsc --noEmit` passou (exit 0).
24. ✅ **CORREÇÃO — Pedidos de Compra: bloqueio de provisão sem pagamento + exclusão segura** (2026-08-01): (a) `POST /api/super-adm/orders/provision` agora **rejeita pedidos que não estejam `PAGAMENTO_CONFIRMADO`** (400) — impede empresa não paga de entrar como "Ativa"; (b) `dashboard-master/page.tsx` MRR agora filtra `c.status==='Ativo' && c.subscription_status !== 'incomplete'`; (c) **novo `POST /api/super-adm/orders/delete`** (só super_adm; bloqueia pedidos `PROVISIONADO`/com `provisioned_company_id` para não orfanar empresa; audita via `audit_logs`); (d) UI da tabela: botão "Provisionar Empresa" só aparece em `PAGAMENTO_CONFIRMADO` e novo botão "Excluir" (vermelho) para não-provisionados com `ConfirmModal` de confirmação + banner de sucesso. `npx tsc --noEmit` passou (exit 0).
25. ✅ **CORREÇÃO — "100 Chamadas Reais" renomeada para Simulação** (2026-08-01): UI em `super-adm/page.tsx` ("Suite de Simulação com 100 Chamadas de IA", "Executar Simulação...", "Relatório Sintético (100 Requisições Simuladas)") + descrição deixa claro que é **simulação sintética** sem consumo real; logs gerados por `POST /api/test/ai-simulation` agora têm `funcionalidade: "Simulação IA #N (dado sintético)"` (identificáveis/filtráveis no FinOps). `npx tsc --noEmit` passou (exit 0).
26. ✅ **CORREÇÃO CRÍTICA — Integração Conta Azul: sync não atualizava + clientes sumiam** (2026-08-01): 4 bugs raiz identificados e corrigidos:
    - **Bug 1 — Formato `contaazul_config` objeto vs array** (causa primária do sync quebrado): `update_contaazul_config` em `/api/db` gravava sempre como **objeto plano** (`db.contaazul_config = {...spread}`), mas `auto-sync/route.ts:35` esperava **array** e convertia para `[]` (destruindo os tokens). Resultado: `connectedConfigs.length === 0` → loop não rodava → sync "sucesso" sem fazer nada. **Fix** em `/api/db` (`update_contaazul_config`): upsert por `company_id` em array + migração de legado objeto→array preservando dados. **Fix** em `auto-sync/route.ts`: migração preserva entrada existente do objeto. **Fix** em `serverDb.ts` (`updateContaAzulConfig`): passa `company_id` no payload. **Fix** em `contaazul/page.tsx` (`saveConfig`): inclui `companyId: getActiveTenantId()`. **Fix** em `serverDb.ts` (`fetchContaAzulConfig`): trata tanto array quanto objeto legado. `ContaAzulConfig` interface ganhou `companyId?: string`.
    - **Bug 2 — `handleCreateCustomer` sem `company_id`**: `newClientObj` construído sem `company_id` → filtro do `GET /api/db` (linha 376-379) exclui registros sem `company_id` → cliente some após qualquer reload. **Fix**: `newClientObj` agora inclui `company_id: getActiveTenantId()`. Mesmo fix para `handleCreateSupplier`. Frontend envia `companyId` no body para as rotas `/api/contaazul/customers` e `/api/contaazul/suppliers`. Rotas também gravam com `company_id` no DB local.
    - **Bug 3 — `set_table` destrutivo após criação** (race condition): `saveContaAzulClients(updated)` chamava `setServerTable` → `action:"set_table"` → sobrescreve a tabela inteira com snapshot local desatualizado, apagando registros gravados pelo servidor em paralelo. **Fix**: removido o `set_table` de `handleCreateCustomer` e `handleCreateSupplier`; substituído por `setSyncedClients(prev => [newObj, ...prev])` (atualização otimista) + `loadContaAzulData()` (reload do banco para consistência real).
    - **Bug 4 — sync retorna "sucesso" silencioso sem configs**: quando 0 configs conectadas, o auto-sync retornava `{ success: true, results: [] }` → frontend exibia "Sincronização 24/7 concluída!" sem avisar problema. **Fix**: auto-sync retorna `{ success: false, error: "Nenhuma integração ativa..." }` (HTTP 400) → frontend exibe mensagem de erro com instrução de reautorizar.
    - **Bônus**: rota `/api/contaazul/suppliers` ganhou persistência no DB local (antes não gravava nada, só retornava o objeto da API).
27. ✅ **ISOLAMENTO MULTI-TENANT — tokens OAuth Conta Azul por empresa** (2026-08-01): 7 gaps de isolamento corrigidos — cada empresa tem sua própria sessão Conta Azul, sem vazamento entre tenants:
    - **callback/route.ts**: POST recebe `companyId` do body e chama `saveContaAzulTokens(companyId, tokens)` (antes usava overload legado que caía em `comp_zenitus` default).
    - **contaazul/page.tsx**: `exchangeCodeForToken` envia `companyId: getActiveTenantId()` no body; `loadContaAzulData` passa `activeCompanyId` ao `fetchContaAzulConfig`.
    - **auto-sync/route.ts**: removido fallback hardcoded `getContaAzulTokens("comp_zenitus")` — busca tokens apenas do `targetCompanyId` real.
    - **serverDb.ts**: `fetchContaAzulConfig(companyId?)` aceita companyId e envia `x-company-id` header para o `GET /api/db` filtrar a config da empresa certa.
    - **db/route.ts**: `DEFAULT_DB.contaazul_config` inicializado como **array**, nunca mais objeto plano.
    - **auto-sync per-company**: `fetchWithAutoRefresh` já é chamado com `companyId` correto (linha 88 do loop).
    - **store.ts**: `getContaAzulTokens(companyId)` já lê do arquivo keyed por companyId; `saveContaAzulTokens(companyId, tokens)` já isola por chave.
    `npx tsc --noEmit` passou (exit 0).
28. ✅ **REWORK DO DASHBOARD EXECUTIVO (`/dashboard`) — período + estilo profissional** (2026-08-01): atendendo ao review do usuário em modo empresa:
    - **Seletor de período** no header (7/15/30/60/90 dias, Este ano, Todo período) — aplicado a KPIs e gráficos sem refetch (dados brutos em `rawDataRef`; `applyPeriodToData` recomputa via `useEffect` em `period`). Contas a Pagar agora filtra por vencimento no período; gráfico de tendência passa a usar buckets dinâmicos (janelas de tempo) em vez de Jan-Ago fixo.
    - **Contas a Pagar**: removida a legenda "Total de obrigações em SQLite" (ruído técnico) → "X obrigações a vencer no período".
    - **Encartes profissionais**: 4 KPIs + 3 alertas reestilizados no padrão do painel OmniCoins & IA (bg-slate-50/50, border-slate-200/70, badge colorido por métrica, hover suave).
    - **Solicitações em Aprovação**: agora mostra **pendentes** (qtd + R$ + urgentes) e, abaixo, **aprovadas no período** (qtd + R$) — antes só contabilizava pendentes.
    - **Integração ContaAzul Pro**: seção expandida com 4 cartões (Clientes, A Receber/quitados, A Pagar/pendentes + qtd, Total de lançamentos) com valores financeiros reais de `contaazul_entries` (novos states `caPayableTotal`/`caReceivableTotal`/`caPaidTotal`/`caPendingCount`).
    - **Atividade Recente removida** (feed de audit_logs não fazia sentido no Dashboard); removidos imports órfãos (`Activity`, `fetchAuditLogs`, `timeAgo`) e estado `activityFeed`.
29. ✅ **PAINEL ANALÍTICO — caixa real do Conta Azul integrado + descrição corrigida** (2026-08-01): (a) descrição da seção corrigida para "(Contratos, Pagáveis, Solicitações e Caixa ContaAzul)" — antes dizia "e Caixa" mas não usava caixa; (b) **pie de Solicitações agora respeita o período** (`periodRequests` filtrado por `withinPeriod`) — antes contava todo o histórico; (c) **Receita e Despesas dos gráficos agora usam `contaazul_entries` reais**: `receita = MRR + caReceita` (entries tipo RECEITA/RECEBER/ENTRADA) e `despesas = pagáveis + caDespesa` (restante), por bucket de tempo via `data_pagamento`/`data_vencimento`. Removida a "linha reta de MRR" que era repetida em todos os buckets. Badge do gráfico 4 renomeado para "Fluxo do Período Positivo/Negativo". `npx tsc --noEmit` passou (exit 0).
30. ✅ **OMNI IA HUB — chat mais agradável + persistência real da resposta** (2026-08-01): análise completa do fluxo (`omni-ia/page.tsx` + `/api/chat`):
    - **Bug principal — resposta da IA sumia ao trocar de tela**: a resposta só era persistida pelo servidor (`/api/chat:299-319`), e **nunca no fallback** (sem chave de API → rota retorna texto canônico e NÃO grava). O cliente mostrava a resposta só em estado React → ao navegar, `loadingConvIds` e a mensagem sumiam. **Fix**: o cliente agora persiste a resposta via `insertServerTable('messages')` **quando o servidor não o fez** (header `x-omni-message-id` ausente) — tanto sucesso quanto fallback/erro. Evita duplicação quando o servidor já gravou.
    - **Conversa ativa não era restaurada**: `page.tsx:184` sempre caía na primeira conversa no mount. **Fix**: `localStorage.omnizeus_omniia_active_conv` — o `useEffect` de `activeConvId` salva a conversa atual; no mount, `loadConversationsFromSql` restaura a última conversa salva (se ainda existir).
    - **Layout**: adicionada **barra de contexto da conversa** (agente/persona ativa + modelo em uso) acima das mensagens; área de mensagens ampliada de `max-w-2xl` → `max-w-3xl` para aproveitar o espaço lateral. Welcome screen (cards de especialistas) mantido.
    `npx tsc --noEmit` passou (exit 0).
31. ✅ **OMNI IA HUB — processamento global persistente (fix definitivo do "Processando some")** (2026-08-01): o problema persistia porque o fetch rodava dentro do componente React — trocar de tela desmontava o componente e descartava o resultado. **Fix definitivo**:
    - **Novo `src/lib/ai/chatSession.ts`** — módulo global de jobs de chat que roda FORA do ciclo de vida do componente: mantém `pendingJobs` (mapa convId→bool), executa o fetch `/api/chat`, persiste tudo via `/api/db` e dispara eventos `omnizeus_omniia_job_change` / `omnizeus_omniia_message_persisted`. Sobrevive à navegação.
    - **Placeholder persistente `__PROCESSING__`**: ao iniciar, insere mensagem AI com `pending: true` e texto `__PROCESSING__` no DB. Ao voltar/F5, a conversa mostra "Processando análise..." (spinner derivado de `hasPendingMessage` → `isActiveConvLoading`), não mais o estado efêmero.
    - **Sem duplicação**: `runChatJob` NÃO envia `conversationId` ao `/api/chat` (evita segunda gravação server-side) — o placeholder é atualizado para a resposta final via `updateServerTableRecord` (`pending:false`). Fallback/erro também atualiza o placeholder com a mensagem de instabilidade.
    - **page.tsx**: `executeChatQuery` agora chama `runChatJob`; adicionados listeners de `OMNIIA_JOB_EVENT` (sincroniza `loadingConvIds` com jobs globais) e `OMNIIA_MESSAGE_EVENT` (recarrega mensagens com `force=true`); `loadMessagesFromSql` extraído para escopo do componente com tratamento de placeholder e `force`; interface `Message` ganhou `pending?`.
    `npx tsc --noEmit` passou (exit 0).
32. ✅ **OMNI CONTA AZUL IA — processamento global (mesmo fix do Omni IA Hub)** (2026-08-01): verificado que o chat do menu `omni-contaazul-ia` tinha o MESMO bug (fetch inline no componente + `setProcessingConvId`/`setMessages` efêmeros). **Fix**:
    - **Novo `src/lib/ai/contaazulChatSession.ts`** — módulo global com `pendingJobs` por conversa, executa o fetch `/api/contaazul/ia-workspace` fora do componente e dispara `omnizeus_contaazul_ia_job_change` (`CAI_JOB_EVENT`). Sobrevive à navegação; a rota já persiste as mensagens no DB, então a resposta não some.
    - **omni-contaazul-ia/page.tsx**: `handleSendPrompt` agora chama `runCaiJob` (não mais fetch inline); listener `CAI_JOB_EVENT` re-sincroniza `processingConvId` e recarrega mensagens via `loadConversationMessages`; no mount, `loadInitialData` restaura `processingConvId` se `isCaiProcessing(targetId)` (voltar durante processamento mostra o spinner).
    `npx tsc --noEmit` passou (exit 0).
33. ✅ **OMNI CONTA AZUL IA — modelo fixo, seletor removido** (2026-08-01): o agente é único (analisar dados do ContaAzul, responder perguntas e gerar gráficos JSON) — não fazia sentido ter seletor de modelo. **Fix**: removido `<select>` de modelos do header e o estado `selectedModel`/`modelGroups`; modelo fixado em `CONTAAZUL_AI_MODEL_ID = "anthropic/claude-4.8-sonnet"` (mapeado via `MODEL_MAP` → `anthropic/claude-3.7-sonnet`, o modelo real mais robusto do OpenRouter para dados estruturados + geração de gráficos). Header agora mostra **badge minimalista** "Claude 4.8 Sonnet (Anthropic)" com ícone `Cpu` (responsivo: "Claude 4.8" em telas pequenas). `npx tsc --noEmit` passou (exit 0).
34. ✅ **OMNI IA HUB — layout redesenhado no padrão do Omni Conta Azul IA** (2026-08-01): reestruturado todo o render do `/omni-ia` copiando a organização elegante do `omni-contaazul-ia`:
    - **Container full-height sem espaço lateral**: `-m-4 sm:-m-6 lg:-m-8 flex flex-col h-[calc(100vh-64px)] bg-[#F8FAFC] overflow-hidden` (antes `h-[calc(100vh-7rem)]` com bordas).
    - **Header fixo superior descritivo**: botão toggle de histórico (ícone `History`), ícone do workspace (bloco azul `Sparkles`), título "Workspace Omni IA Hub" + badge "Chat Especialistas" + subtítulo descritivo; à direita **badge do modelo em uso** (ícone `Cpu`, responsivo) e badge "5 Coins / Consulta".
    - **Sidebar 260px** com botão "Nova Consulta" (primário), seletor de **Agente Especialista** (BookOpen) e **Modelo de IA** (Cpu) em campos minimalistas; lista de conversas com estado ativo azul (em vez de branco) e ações hover (pin/renomear/excluir).
    - **Área de chat estilo bubble**: mensagens com `max-w-[85%]`, usuário à direita (`bg-primary rounded-tr-none`), IA à esquerda (branco `rounded-tl-none`), avatar só para IA (bloco `Sparkles`); barra de contexto da conversa acima das mensagens; input bar no padrão do Conta Azul (container `max-w-4xl` com rodapé "5 OmniCoins / Consulta" + modelo).
    `npx tsc --noEmit` passou (exit 0).

**Próximos passos:**
- **Testar o Omni IA Hub no navegador** (modo empresa): iniciar conversa → "Processando análise..." → trocar de tela → voltar → a resposta deve **permanecer** (persistida). Trocar de conversa e voltar deve restaurar a última ativa.
- **Testar o fluxo completo no navegador**: (1) ir em "Credenciais & OAuth 2.0", salvar credentials e clicar "Autorizar via Navegador" → callback → token salvo no array. (2) clicar "Sincronizar Agora" → deve buscar os 2 clientes reais do Conta Azul. (3) cadastrar um novo cliente → deve aparecer e **não sumir** após atualizar.
- **Validar o Dashboard Executivo rework no navegador** (gestor em modo empresa): seletor de período 7/15/30/60/90/ano, KPIs reestilizados, Solicitações com pendentes+aprovadas, seção ContaAzul Pro com valores, sem Atividade Recente.
- Validar visualmente `/dashboard-master` no navegador (login `jsgleisson@gmail.com` / `Design20`, super_adm em modo SaaS) — confirmar que o flash de "Acesso Estritamente Negado" sumiu.
- (Pendente) investigar build quebrado pré-existente de `/contaazul` e `/api/agents/improve`.
- (Pendente) implementar guards de ROTA por módulo (funcionário não deve acessar `/financeiro` por URL direta) — hoje só o menu esconde.
- (Pendente) avaliar quirk do `store.ts` em que `monthlyRevenueBrl > 5000` é substituído pelo preço padrão do plano no FinOps (receitas legítimas altas subestimadas).

**Análise do Dashboard Executivo — achados (2026-08-01):**
- KPI "Compliance & SLA" estava 100% hardcoded; MRR somava contratos "Pendente"; KPI "Tarefas" contava concluídas; badge de fluxo era estático; `fetchDashboardMetrics()` era código morto.
- Gráfico de tendência Jan-Ago concentrado em Ago/2026 porque o seed cria tudo em 08/2026 (aceito — reflete os dados; opção de espalhar no seed não foi escolhida).

**Melhorias IMPLEMENTADAS (aguardando validação):**
- **KPIs dinâmicos**: Compliance & SLA = % de obrigações em dia (payables não vencidos); Tarefas mostra "em aberto" (Pendente + Em Andamento) com total; Contratos/MRR só status "Ativo".
- **Nova linha de alertas**: Contas Vencidas (qtd + R$), Solicitações em Aprovação (qtd + R$ + urgentes), Colaboradores (qtd).
- **Novo painel OmniCoins & IA**: Saldo de Coins, Coins Consumidas (% da franquia), Tokens de IA, Interações; barra de consumo da franquia; gráfico "Top Agentes por Consumo (Coins)" (BarChart vertical) e "Consumo por Hub de IA" (PieChart).
- **Feed de Atividade Recente**: funde `audit_logs` + últimos 40 `ai_usage_logs`, ordena por data, mostra time-ago.
- **Removido** `fetchDashboardMetrics()` (código morto) e badge de fluxo agora dinâmico (Positivo/Negativo).
- **`serverDb.ts`**: adicionado `fetchAIUsageLogs()` / `insertAIUsageLog()`.
- Formatação pt-BR via helpers `formatBRL`/`formatInt`/`timeAgo`.

**Validação técnica (2026-08-01):**
- `npx tsc --noEmit` ✅ sem erros.
- `npm run build` ✅ meus arquivos compilam ("✓ Compiled successfully" + type check ok), MAS o build da branch main JÁ FALHAVA antes: na versão limpa erra no prerender de `/contaazul`; com minhas mudanças erra na coleta de dados de `/api/agents/improve` ("Cannot find module for page"). **Build quebrado é pré-existente, não relacionado às minhas alterações** — a ser investigado em outra tarefa.
- ESLint não está configurado no projeto (não há `.eslintrc`).

**BUG CRÍTICO CORRIGIDO — Dashboard "sem CSS"/congelado (2026-08-01):**
- **Sintoma**: usuário relatou dashboard "quebrado, desformatado, CSS não carregou".
- **Causa raiz**: loop infinito de fetch em `src/lib/coins/store.ts` + `src/components/layout/Header.tsx`. O Header chama `getCoinBalance('comp_zenitus')` (default) quando não acha a empresa ativa; como `comp_zenitus` não existe no banco, `fetchCoinBalanceFromServer` **nunca populava o cache** → cada `.then()` disparava `omnizeus_coins_change` → Header chamava `getCoinBalance` de novo → **loop infinito** (centenas de `GET /api/db?table=companies` por minuto, lendo o JSON inteiro do disco a cada request → servidor/browser inundados, página parecia quebrada).
- **Correção (em `coins/store.ts`)**: `fetchCoinBalanceFromServer` agora **sempre popula o cache** (`inMemoryBalances[companyId]` = saldo real OU 0 quando empresa não encontrada; também 0 no catch). `getCoinBalance` só dispara `omnizeus_coins_change` quando o valor **realmente muda**. Loop eliminado.
- **Validação**: dev server testado — antes: 778 chamadas `?table=companies`; depois do fix: **11 chamadas e estável**. HTML do dashboard retorna 200 com `layout.css` linkado e sem markers de erro.
- **Observação**: bug pré-existente (não causado pelas melhorias do Dashboard), mas explodia justamente com o Super Admin logado em contexto 'global' + seed multi-tenant.

**Decisões / combinados:**
- Manter este log sempre atualizado ao longo da conversa.
- Revisão menu a menu; o usuário aponta o próximo menu ao fechar o atual.
- Usuário escolheu "Implementar tudo" no Dashboard (sem alterar seed).

**Próximos passos:**
- Usuário valida o Dashboard Executivo no navegador (com o fix do loop de Coins, a página deve carregar formatada) e confirma os novos painéis (Coins & IA, alertas, atividade).
- (Pendente, não priorizado) investigar build quebrado de `/contaazul` e `/api/agents/improve`.
- Seguir para o próximo menu indicado pelo usuário.

**Pendências / bloqueios:**
- Build de produção da branch main falha em páginas pré-existentes (`/contaazul` prerender, `/api/agents/improve` page data) — não causado pelas mudanças do Dashboard.
