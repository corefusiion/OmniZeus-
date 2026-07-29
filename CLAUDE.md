# OmniZeus — Technical Architecture & Onboarding Guide (Claude AI)

> **Anthropic / Claude Technical Guide**: This document summarizes the technical stack, state management, security boundaries, file paths, and conversation logs of **OmniZeus** for fast onboarding across model switches or new development environments.

---

## 🛠️ Key Technical Specifications

- **Framework**: Next.js 14 (App Router Edge & Client Components)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + Custom CSS Utilities (`#1E6FD9`, `#0F172A`, `#F8FAFC`, `#E2E8F0`)
- **Icons**: Lucide React (`strokeWidth={1.5}`)
- **Charts**: Recharts (`AreaChart`, `PieChart`, `ResponsiveContainer`)
- **PDF Generation**: Native A4 Print Styles & Browser Window Exporter
- **WhatsApp Integration**: Evolution API Webhook (`/api/whatsapp/webhook`) & Base64 QR Code renderer

---

## 🔒 Security & Multi-Tenant Role Engine

Located in `src/lib/auth/roles.ts`:
- `UserRole = 'super_adm' | 'gestor' | 'funcionario'`
- State changes broadcast a custom DOM event:
  ```ts
  window.dispatchEvent(new Event('omnizeus_role_change'));
  ```
- All pages and navigation items (`src/components/layout/nav-config.ts`) reactively filter menu items and restricted components based on the active role.
- **Instance & QR Code Security Rule**: The Instance Status & QR Code tab in `/whatsapp-bot` is hidden for `funcionario` users and accessible exclusively to `gestor` and `super_adm`.

---

## 🪙 Internal Currency & API Proxy Architecture

Located in `src/lib/coins/store.ts` and `src/app/api/chat/route.ts`:
1. Customers pay for **OmniCoins** (1 Coin = R$ 0.10).
2. The Edge runtime route `/api/chat` proxies calls to **OpenRouter API** (`https://openrouter.ai/api/v1/chat/completions`).
3. OpenRouter canonical models mapped directly: `openai/gpt-4o`, `anthropic/claude-3.7-sonnet`, `google/gemini-2.5-pro`, `deepseek/deepseek-r1`, `moonshotai/moonshot-v1-128k`.
4. OpenRouter API Key and real USD costs are hidden from clients and managed strictly via the Super ADM panel (`/super-adm`).

---

## 📍 Conversation Log & Trajectory Paths

To inspect or resume the conversation history for this workspace:

- **Conversation ID**: `6f878aa0-cefe-4fed-b53b-87051d484243`
- **Compact Log (JSONL)**:
  `C:\Users\jessica\.gemini\antigravity\brain\6f878aa0-cefe-4fed-b53b-87051d484243\.system_generated\logs\transcript.jsonl`
- **Full Untruncated Log**:
  `C:\Users\jessica\.gemini\antigravity\brain\6f878aa0-cefe-4fed-b53b-87051d484243\.system_generated\logs\transcript_full.jsonl`

---

## 🚀 Quick Command Reference

```bash
# Start development server
npm run dev

# Production build validation
npm run build
```
