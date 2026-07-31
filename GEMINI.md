# OmniZeus — Manual de Arquitetura & Guia de Contexto (Gemini AI)

> **Antigravity / Gemini Context Guide**: Este documento contém todo o escopo, arquitetura de software, modelo de dados, monetização, guias estéticos e os caminhos de log da conversa do projeto **OmniZeus**, permitindo que qualquer assistente de IA compreenda o estado atual do código e continue o desenvolvimento imediatamente.

---

## 📜 1. Resumo do Produto (Product Overview)
**OmniZeus** é uma plataforma SaaS B2B All-in-One desenvolvida especificamente para **Escritórios de Contabilidade e Prestadores de BPO Financeiro no Brasil**.

A plataforma unifica 7 módulos principais:
1. **Omni IA Hub (`/omni-ia`)**: Assistente inteligente com 15 modelos de ponta (OpenAI GPT-4o/o3-mini, Anthropic Claude 3.7 Sonnet/Opus, Google Gemini 2.5 Pro/Flash, Kimi Moonshot, DeepSeek R1/V3) via OpenRouter com streaming em tempo real.
2. **Integração Conta Azul & IA DRE (`/contaazul` & `/omni-contaazul-ia`)**: Sincronização automática de lançamentos, clientes, fornecedores e categorias DRE com gráficos de barras Recharts, filtros defensivos contra campos nulos (`categoryName`) e workspace de IA para DRE.
3. **Gestão Financeira & Contas a Pagar (`/financeiro`)**: Gráfico suave em curva Recharts da evolução mensal de gastos (Jan-Set), 3 encartes KPIs ultra-minimalistas sem cores chamativas, exportação direta em PDF e sistema de OmniCoins.
4. **WhatsApp Bot & Live Chat Multi-Setor (`/whatsapp-bot`)**: 
   - **Leitor de QR Code Base64**: Integração com a Evolution API com leitor Base64 e parâmetros da instância (visível **apenas para Gestor/Super ADM**).
   - **Visão Dupla Lista / Kanban**: Alternador entre lista tradicional de mensagens e quadro Kanban por estágios (*Aguardando*, *Em Atendimento*, *Transferido*, *Finalizado*).
   - **Controles de Chat**: Fixação de conversas no topo (`isPinned`), exclusão (`Trash2`) e transferência entre setores contábeis com histórico mantido.
   - **Persona de Atendimento de IA**: Ajuste do prompt do sistema, horário de atendimento e respostas automáticas.
   - **Fluxos Automáticos Configuráveis**: Editor e simulador de disparos de impostos (DAS/DARF), cobranças e folha.
5. **Gestão de Tarefas Operacionais (`/tarefas`)**: Quadro dual (Visão Gestor vs Funcionário), filtro padrão inicial em *"Pendente"*, cronômetro automático de tempo gasto e resolução por IA alimentada pelo **Google Gemini 2.5 Pro**.
6. **Gerador de Documentos Corporativos (`/documentos`)**: Criação de contratos, propostas e notificações fiscais em formato folha A4 com exportação para PDF.
7. **Gerador de Apresentações Executivas (`/apresentacoes`)**: Decks de slides dinâmicos (3, 5, 8 ou 10 slides) gerados via IA com 7 temas visuais e exportação em tela cheia.

---

## 🔐 2. Autenticação, RBAC & Isolamento Multi-Tenant por Empresa

Definido em `src/lib/auth/roles.ts`, `src/app/api/auth/me/route.ts` e `src/app/api/db/route.ts`:

1. 👑 **Super ADM (`super_adm`)**:
   - Dono master da plataforma SaaS.
   - Acessa o menu exclusivo **Master Configs (`/super-adm`)**.
   - Possui acesso ao **Seletor Global de Empresas** no topo (`Header.tsx`) para alternar livremente o contexto entre os escritórios.
   - Gerencia a chave master da OpenRouter (`OPENROUTER_API_KEY`), chaves do Stripe e margem de lucro por OmniCoins.

2. 🛡️ **Gestor (`gestor`)**:
   - Proprietário do escritório contábil cliente.
   - Visualiza todos os departamentos, relatórios financeiros, status da instância do WhatsApp e configuração de personas.
   - **Restrição:** O seletor global de empresas é **ocultado**. Seu contexto é fixado estritamente na sua empresa cadastrada (`companyId`).

3. 👤 **Funcionário (`funcionario`)**:
   - Operador do escritório.
   - Acessa estritamente os módulos permitidos e tarefas do seu departamento.
   - **Restrição:** Ocultação total de dados financeiros (OmniCoins, ROI, chaves de API), aba de Status da Instância do WhatsApp e Seletor de Empresas.

### 🛡️ Trava de Segurança Server-side Anti-Cross Tenant (`/api/db`):
- Todas as rotas de banco de dados (`GET`, `POST`, `PUT`, `DELETE`) validam o cookie HttpOnly `omnizeus_session`.
- Se um usuário com perfil `gestor` ou `funcionario` tentar consultar ou modificar registros de outro `company_id`, o backend bloqueia a operação imediatamente retornando **`403 Forbidden`**.

---

## 💳 3. Engenharia de Monetização, Stripe & OmniCoins

- **Taxa de Conversão:** 1 OmniCoin = R$ 0,10.
- **Planos Mensais:** Profissional (R$ 490 / 5k Coins), Premium (R$ 890 / 15k Coins), Business (R$ 1.990 / 50k Coins).
- **Integração Stripe Checkout & Webhook:**
  - `POST /api/checkout/create-session`: Criação de sessões de checkout no Stripe.
  - `POST /api/webhook/stripe`: Processador oficial de webhooks (`checkout.session.completed`, `invoice.payment_succeeded`).
  - `POST /api/checkout/customer-portal`: Redirecionamento para portal do cliente Stripe.
- **Margem Líquida Real:** **98.6%** (Cobrança R$ 890,00/mês vs Custo real de API OpenRouter ~US$ 2.16).

---

## 📁 4. Estrutura de Arquivos do Projeto (`src/`)

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx         # Visão geral de KPIs e status de tarefas
│   │   ├── financeiro/page.tsx        # Contas a Pagar, Gráfico de Linhas e PDF
│   │   ├── contaazul/page.tsx         # Painel de Controle e DRE do Conta Azul
│   │   ├── omni-contaazul-ia/page.tsx # Workspace de IA para Conta Azul
│   │   ├── omni-ia/page.tsx           # Hub de 15 LLMs e Personas de IA
│   │   ├── documentos/page.tsx        # Gerador de Documentos A4 PDF
│   │   ├── apresentacoes/page.tsx     # Gerador de Slides com 7 Temas
│   │   ├── tarefas/page.tsx           # Gestão de SOPs, Timer e Gemini 2.5 Pro
│   │   ├── whatsapp-bot/page.tsx      # WhatsApp Bot, QR Code, Kanban e Setores
│   │   ├── configuracoes/page.tsx     # Dados da Empresa, Equipe e Personas
│   │   └── super-adm/page.tsx         # Painel Master OpenRouter & Stripe
│   ├── api/
│   │   ├── auth/me/route.ts           # Reidratação de Sessão HttpOnly
│   │   ├── auth/login/route.ts        # Login e Emissão de Cookie de Sessão
│   │   ├── checkout/                  # API Checkout & Customer Portal Stripe
│   │   ├── webhook/stripe/route.ts    # Webhook de Notificações do Stripe
│   │   ├── db/route.ts                # Endpoint SQLite/JSON com Guarda 403 Multi-Tenant
│   │   └── chat/route.ts              # Proxy Stream Edge OpenRouter
├── lib/
│   ├── auth/roles.ts                  # Hierarquia de Roles e Reidratação
│   ├── auth/session.ts                # Utilitários de Cookie HttpOnly
│   ├── coins/store.ts                 # Store de OmniCoins
│   ├── tasks/store.ts                 # Store de Tarefas com Timer Automático
│   └── company/store.ts               # Dados cadastrais da empresa
data/
└── omnizeus_local_sql_database.json   # Banco de dados local com 3 empresas de teste
scripts/
└── execute-controlled-multitenant-test.js # Script de carga e isolamento multi-tenant
```

---

## 🧪 5. Credenciais de Teste Multi-Tenant (Persistidas no Banco)

- 👑 **Super Admin Master:** `jsgleisson@gmail.com` / `Design20` *(Acesso global + Seletor)*
- 🛡️ **Gestor Alpha:** `gestor_alpha@teste-alpha.local` / `Design20` *(Empresa Teste Alpha)*
- 👤 **Funcionário Alpha:** `funcionario02@teste-alpha.local` / `Design20` *(Empresa Teste Alpha)*
- 🛡️ **Gestor Beta:** `gestor_beta@teste-beta.local` / `Design20` *(Empresa Teste Beta)*
- 🛡️ **Gestor Gamma:** `gestor_gamma@teste-gamma.local` / `Design20` *(Empresa Teste Gamma)*

---

## 📍 6. Localização e Registro dos Logs de Conversa (Transcript Files)

Para recuperar, auditar ou continuar o histórico desta sessão em qualquer ambiente Antigravity/Gemini:

- **ID Único da Conversa (Conversation ID):** `f6b6bace-f6b2-486e-aa67-66ad81d63ca2`
- **Caminho do Transcript Simplificado (JSONL):**
  `C:\Users\t034183\.gemini\antigravity\brain\f6b6bace-f6b2-486e-aa67-66ad81d63ca2\.system_generated\logs\transcript.jsonl`
- **Caminho do Transcript Completo (JSONL sem truncamento):**
  `C:\Users\t034183\.gemini\antigravity\brain\f6b6bace-f6b2-486e-aa67-66ad81d63ca2\.system_generated\logs\transcript_full.jsonl`

---

## 🎨 7. Padrão Visual (Design System)

- **Cores Globais:** Primário Azul (`#1E6FD9`), Dark Text (`#0F172A`), Surface Gray (`#F8FAFC`), Borders (`#E2E8F0`), Muted (`#64748B`).
- **Minimalismo Enterprise:** Sem degradês amadores, bordas limpas e ícones finos da Lucide React (`strokeWidth={1.5}`).
