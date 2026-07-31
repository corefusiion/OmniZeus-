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
