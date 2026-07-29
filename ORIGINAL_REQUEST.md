# Original User Request

## 2026-07-26T01:09:36Z

**OmniZeus** is an enterprise-grade SaaS platform for Brazilian accounting firms and BPOs that replaces multiple fragmented tools (Claude, ChatGPT, Gamma, Lovable, ContaAzul, Chatbot Maker) with a single, unified product. The MVP focuses on: a multi-LLM AI hub, document & presentation generation, a WhatsApp chatbot skeleton (Evolution API), and ContaAzul API v2 integration — all delivered in a pixel-perfect professional UI.

Working directory: `c:\Users\jessica\Desktop\MVP`
Integrity mode: development

---

## Technical Foundation

**Stack:**
- Next.js 14 App Router + TypeScript
- shadcn/ui components + Tailwind CSS (reference: kiranism/next-shadcn-dashboard-starter pattern)
- Supabase (PostgreSQL + Auth)
- OpenAI SDK, Anthropic SDK, @google/generative-ai SDK

**External APIs:**
- Evolution API (WhatsApp): REST API with `apikey` header — base: `https://api.yourdomain.com`
- ContaAzul API v2: OAuth 2.0 Bearer Token — base: `https://api-v2.contaazul.com/`

**Agent Skill References (for AI personas):**
- Use sophisticated system prompts for code generation, document creation, and slide generation personas
- Reference chain-of-thought prompting for complex document generation

---

## Design System (STRICT — do not deviate)

This is a CRITICAL requirement. The UI must look like a premium enterprise product (Linear.app, OmniHR, Notion) — not like an AI-generated app.

```
Color Palette:
  Primary:    #1E6FD9  (blue — interactive elements, active states)
  Primary-Lt: #4A90E2  (lighter blue — hover states)
  White:      #FFFFFF  (cards, modals, sidebar)
  Surface:    #F8FAFC  (page backgrounds)
  Border:     #E2E8F0  (all borders, dividers)
  Text-Dark:  #0F172A  (headings, primary text)
  Text-Muted: #64748B  (secondary text, labels)
  Success:    #10B981  (only for status indicators)
  Warning:    #F59E0B  (only for status indicators)

Typography:
  Font: Inter (import from Google Fonts)
  Heading: font-semibold, tracking-tight
  Body: font-normal, leading-relaxed
  Code/mono: JetBrains Mono

Layout:
  Sidebar: Fixed left, 240px wide, white bg, shadow-sm
  Content: Full width minus sidebar, bg-surface (#F8FAFC)
  Cards: white bg, 1px border #E2E8F0, rounded-lg (8px), shadow-sm
  Max content width: 1280px, centered

Rules (FORBIDDEN):
  NO gradients anywhere
  NO harsh/saturated colors (no red, no neon green)
  NO rounded corners > 12px on containers
  NO box shadows larger than shadow-md
  NO placeholder text or Lorem Ipsum
  NO emoji in UI elements
  NO hero animations on functional pages
```

---

## Requirements

### R1. Application Shell & Authentication
Build the complete application shell: sidebar navigation, top header bar with user menu, and page routing. Implement authentication with Supabase Auth (email + password). Protected routes redirect to login. Sidebar must contain: Dashboard, Omni IA (chat), Documentos, Apresentações, WhatsApp Bot, Integração ContaAzul, Configurações. Each nav item has a Lucide icon + label. Active state shows primary blue left border + light blue background.

### R2. Omni IA — Multi-LLM Chat Hub
Build a full-featured chat interface (similar to Claude.ai layout) where users can:
- Select from 3 LLMs: GPT-4o (OpenAI), Claude Sonnet (Anthropic), Gemini 1.5 Pro (Google)
- Send messages and receive streamed responses
- View conversation history in a left panel (list of past conversations, stored in Supabase)
- Start a new conversation with a button
- Choose a system persona from a dropdown: "Assistente Geral", "Especialista Fiscal", "Redator de Contratos", "Consultor de RH"
- API keys are read from environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY)

System prompts for each persona must be sophisticated and reflect Brazilian accounting/tax law expertise. The code generation persona should act as a senior full-stack developer.

### R3. Document Generator (PDF)
Build a dedicated "Documentos" page where users can:
- Select a document template: "Contrato de Prestação de Serviços", "Proposta Comercial", "Relatório de Atividades", "Procuração"
- Fill a short form with key variables (client name, service description, value, date)
- Click "Gerar com IA" — the system calls the selected LLM to write the document content
- Preview the generated document in a styled preview pane (looks like a real document)
- Download as PDF (use @react-pdf/renderer or puppeteer server action)

### R4. Presentation Generator (Gamma replacement)
Build an "Apresentações" page where users:
- Type a topic/prompt (e.g., "DCTFWeb — guia prático para contadores")
- Select number of slides (5, 8, 10, 15)
- Select a color theme (Profissional Azul, Moderno Escuro, Clean Branco)
- Click "Gerar Apresentação" — the LLM generates structured JSON with slides (title, bullet points, speaker notes)
- Slides render beautifully in a full-screen presentation viewer (keyboard navigation with arrows)
- Export to downloadable HTML file that works offline

### R5. WhatsApp Bot Dashboard (Evolution API Skeleton)
Build a "WhatsApp Bot" page with:
- Instance creation form (instance name, description)
- QR code display area (polls `/instance/connectionStatus/{instance}` every 3 seconds to get QR)
- Status badge: Disconnected / Connecting / Connected (green)
- Bot persona configuration: text area for custom system prompt, dropdown for which LLM to use
- Message log: real-time display of incoming/outgoing messages via webhook endpoint (`POST /api/webhook/whatsapp`)
- Webhook endpoint at `/api/webhook/whatsapp` that receives Evolution API events and logs them to Supabase
- All Evolution API calls go through Next.js API routes (never expose apikey to client)

Evolution API key endpoints:
- POST /instance/create — Create a new WhatsApp instance
- GET /instance/connectionStatus/{instance} — Check connection/QR status
- POST /{instance}/message/sendText — Send text message
- POST /webhook/set/{instanceName} — Configure webhook
- Authentication: `apikey: YOUR_API_KEY` header

### R6. ContaAzul Integration Dashboard
Build an "Integração ContaAzul" page with:
- Connection setup: OAuth 2.0 flow (button that opens ContaAzul auth URL in a popup, handles callback at /api/contaazul/callback, stores token in Supabase encrypted)
- ContaAzul OAuth: auth at `https://auth.contaazul.com/login`, token exchange at `https://auth.contaazul.com/oauth2/token`, scopes: `openid profile aws.cognito.signin.user.admin`
- After connection, a financial overview dashboard showing:
  - Contas a Pagar: list with vendor, amount, due date, status
  - Contas a Receber: list with client, amount, due date, status
  - NFe Emitidas: recent list with number, client, value, date
  - Summary cards: Total a Pagar (this month), Total a Receber (this month), NFe count
- Demo mode toggle that loads realistic Brazilian accounting mock data
- ContaAzul API v2: `/v1/financeiro/eventos-financeiros`, `/v1/notas-fiscais`, `/v1/pessoas`

### R7. Settings Page
Build a Configurações page with sections:
- **Perfil:** name, email (from Supabase Auth)
- **Chaves de API:** show/hide fields for OpenAI, Anthropic, Google API keys (stored in Supabase)
- **Evolution API:** base URL and API key for WhatsApp integration
- **ContaAzul:** OAuth connection status + reconnect button

---

## Acceptance Criteria

### Shell & Auth
- [ ] Login page exists with email/password form, clean centered card layout
- [ ] Sidebar renders all 7 nav items with Lucide icons
- [ ] Active page is highlighted correctly in sidebar
- [ ] Mobile: sidebar collapses to a hamburger menu
- [ ] Unauthenticated users are redirected to /login

### Omni IA Chat
- [ ] LLM selector dropdown works and persists choice per conversation
- [ ] Messages stream in real-time (streaming response, not waiting for full completion)
- [ ] At least one conversation is saved to Supabase and appears in history panel
- [ ] 3 different persona system prompts produce visibly different response styles

### Document Generator
- [ ] PDF download works and produces a properly formatted document
- [ ] Generated document contains correct variable substitution (client name, date, etc.)
- [ ] Preview renders before download

### Presentation Generator
- [ ] Generates minimum 5 slides from a prompt
- [ ] Slide viewer works with keyboard arrow navigation
- [ ] HTML export downloads and renders correctly in browser without internet

### WhatsApp Bot
- [ ] Instance creation calls Evolution API (or returns documented mock response)
- [ ] QR code area shows a placeholder or real QR
- [ ] Webhook endpoint at /api/webhook/whatsapp returns 200 and logs to console/Supabase
- [ ] Message log UI renders with timestamps, sender, content

### ContaAzul
- [ ] OAuth flow initiates (redirect to ContaAzul auth URL with correct params)
- [ ] Demo mode loads realistic mock data correctly
- [ ] Financial cards display formatted BRL currency values

### Design Quality (agent-as-judge rubric)
An independent reviewer must assess:
- [ ] Color palette is exclusively blue (#1E6FD9 variants) and white/gray (#F8FAFC, #E2E8F0) — no other colors except status indicators
- [ ] Font is Inter throughout — no system fonts visible
- [ ] No gradients of any kind
- [ ] Cards have consistent border, radius, shadow
- [ ] Typography hierarchy is clear (h1 > h2 > body > muted)
- [ ] Spacing is consistent (8px grid system)
- [ ] The UI could pass as a product from a professional software company

### Build
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes without TypeScript errors
- [ ] `.env.local.example` is present with all variables documented
- [ ] README.md documents setup steps, feature list, and API integration guide
- [ ] No hardcoded secrets anywhere in source code

---

## Environment Variables Required
Create a `.env.local.example` file:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
CONTAAZUL_CLIENT_ID=
CONTAAZUL_CLIENT_SECRET=
CONTAAZUL_REDIRECT_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```
