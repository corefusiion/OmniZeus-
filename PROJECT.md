# Project: OmniZeus

## Architecture
- **Framework**: Next.js 14 App Router + TypeScript
- **UI & Styling**: Tailwind CSS + shadcn/ui components (Inter font, JetBrains Mono for code)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
- **AI Integrations**: OpenAI SDK (GPT-4o), Anthropic SDK (Claude Sonnet), @google/generative-ai SDK (Gemini 1.5 Pro)
- **External API Integrations**:
  - Evolution API (WhatsApp REST API with `apikey` header)
  - ContaAzul API v2 (OAuth 2.0 Authorization Code Flow + Financial Endpoints)

## Code Layout
- `src/app/` — Next.js App Router pages and API routes:
  - `src/app/(auth)/login/` — Supabase Auth login page
  - `src/app/(dashboard)/` — Main authenticated application shell with fixed sidebar
  - `src/app/(dashboard)/dashboard/` — Dashboard overview page
  - `src/app/(dashboard)/omni-ia/` — Multi-LLM chat interface
  - `src/app/(dashboard)/documentos/` — Document generator & PDF preview/download
  - `src/app/(dashboard)/apresentacoes/` — Presentation generator & slide viewer
  - `src/app/(dashboard)/whatsapp-bot/` — Evolution API instance & webhook log UI
  - `src/app/(dashboard)/contaazul/` — ContaAzul OAuth status & financial dashboard
  - `src/app/(dashboard)/configuracoes/` — Settings (Profile, API keys, Evolution, ContaAzul)
  - `src/app/api/` — API routes for WhatsApp webhook, LLM streaming, ContaAzul OAuth callback
- `src/components/` — UI components (`ui/`, `layout/`, `modules/`)
- `src/lib/` — Utilities, Supabase clients, LLM wrappers, external API clients
- `src/types/` — TypeScript interfaces & database definitions
- `supabase/` — Schema definition, migration SQL files

## Design System Rules (STRICT)
- **Primary Color**: `#1E6FD9` (blue)
- **Primary Hover/Lt**: `#4A90E2`
- **Surface Background**: `#F8FAFC`
- **Card Background**: `#FFFFFF`
- **Borders & Dividers**: `#E2E8F0`
- **Text Dark**: `#0F172A`
- **Text Muted**: `#64748B`
- **Status Indicators**: `#10B981` (Success), `#F59E0B` (Warning)
- **Typography**: Inter font throughout, font-semibold tracking-tight headers, JetBrains Mono for code
- **FORBIDDEN**:
  - NO gradients anywhere
  - NO harsh/saturated colors (no red, no neon green)
  - NO rounded corners > 12px on containers (use `rounded-lg` / 8px)
  - NO box shadows larger than `shadow-md`
  - NO placeholder text or Lorem Ipsum
  - NO emojis in UI elements
  - NO hero animations on functional pages

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite | Requirements-based E2E test infra & test cases (Tiers 1-4) | None | DONE |
| 1 | App Shell & Authentication | Sidebar, Header, Supabase Auth, Route Guard, Login Page | None | IN_PROGRESS |
| M-LOGIN | Login Edge Optimization | Edge password hashing 10-50ms CPU (Web Crypto), query filtering `.eq('email', cleanEmail)` on employees | None | DONE |
| 2 | Omni IA Multi-LLM Chat Hub | Multi-LLM streaming chat, persona prompts, chat history | M1 | IN_PROGRESS |
| 3 | Document & Presentation Generators | PDF doc generator, styled preview, Gamma-like presentation generator, offline HTML export | M1 | DONE |
| 4 | WhatsApp Bot, ContaAzul & Settings | Evolution API dashboard/webhook, ContaAzul OAuth & Financial dashboard, Config page | M1 | IN_PROGRESS |
| 5 | E2E Test Pass & Adversarial Hardening | Pass 100% E2E test suite + Tier 5 white-box coverage hardening | E2E, M1-M4 | PLANNED |

## Interface Contracts
### 1. Supabase Auth & Session
- `src/lib/supabase/client.ts`: Browser client for Supabase Auth & DB queries.
- `src/lib/supabase/server.ts`: Server client (cookies-based) for App Router server components and API routes.

### 2. Multi-LLM Client
- `src/lib/ai/providers.ts`: Unified streaming interface abstraction over OpenAI, Anthropic, Google Gemini SDKs.

### 3. Evolution API Client
- `src/lib/whatsapp/evolution.ts`: API route wrapper for instance creation (`/instance/create`), status check (`/instance/connectionStatus/{instance}`), message sending (`/{instance}/message/sendText`), and webhook setup (`/webhook/set/{instanceName}`).

### 4. ContaAzul Client
- `src/lib/contaazul/client.ts`: OAuth 2.0 flow helper, token refresh logic, and API v2 financial endpoints (`/v1/financeiro/eventos-financeiros`, `/v1/notas-fiscais`, `/v1/pessoas`) with demo mode fallback.
