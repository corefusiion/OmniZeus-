# Teamwork Project Prompt — Draft

> Status: Ready for Launch — Awaiting User Approval
> Goal: Execute multi-agent refactoring and full feature implementation of OmniZeus B2B Accounting SaaS

**OmniZeus** is an enterprise-grade SaaS platform for Brazilian accounting firms and BPO providers. It replaces fragmented tools with a single product encompassing a 15-LLM Hub, Financial Management with Recharts & OmniCoins, Evolution API WhatsApp Bot with Base64 QR Code & Kanban stages, Operational Tasks with Timer & Gemini 2.5 Pro, A4 Document & 7-Theme Slide Presentation Generators, and Super ADM Master Panel.

Working directory: `c:\Users\t034183\Desktop\OmniZeus`
Integrity mode: development

---

## Requirements

### R1. Application Shell & Multi-Tenant Role Engine
- Implement Next.js 14 App Router layout with a 240px fixed sidebar, top header bar, user profile, and OmniCoins balance widget.
- Support 3 User Roles (`super_adm`, `gestor`, `funcionario`) with DOM event broadcasting (`omnizeus_role_change`).
- Enforce strict role-based visibility: hide financial data (OmniCoins balance, ROI, API keys) and WhatsApp QR Code/Instance tab from `funcionario` users.

### R2. Omni IA — Multi-LLM Chat Hub (`/omni-ia`)
- Multi-LLM streaming interface supporting 15 canonical models: OpenAI (GPT-4o, o3-mini), Anthropic (Claude 3.7 Sonnet, Opus), Google (Gemini 2.5 Pro, Flash), Kimi Moonshot, DeepSeek (R1, V3) via OpenRouter proxy (`/api/chat`).
- System personas: "Assistente Geral", "Especialista Fiscal & SPED", "Redator de Contratos", "Consultor de RH & eSocial".
- Automatic OmniCoins deduction (5 Coins = R$ 0,50 per query) with real-time balance check.

### R3. Gestão Financeira & Contas a Pagar (`/financeiro`)
- Smooth Recharts curve graph showing monthly expense evolution (Jan - Set).
- 3 ultra-minimalist KPI cards without loud colors (Total Contas a Pagar, Economia Acumulada, Saldo OmniCoins).
- Direct browser A4 PDF export, detailed payables table, and OmniCoins recharge store.

### R4. WhatsApp Bot & Live Chat Multi-Setor (`/whatsapp-bot`)
- Base64 QR Code reader & Evolution API instance connection status (exclusively visible to `gestor` and `super_adm`).
- Dual View toggle: Traditional Message List vs Kanban Board by stages (*Aguardando*, *Em Atendimento*, *Transferido*, *Finalizado*).
- Chat controls: Top pinning (`isPinned`), deletion (`Trash2`), and sector transfer with history retention.
- AI Bot persona prompt configuration & automated tax/payroll dispatch simulator.

### R5. Gestão de Tarefas Operacionais (`/tarefas`)
- Dual view (Manager vs Employee perspective) with default initial filter set to *"Pendente"*.
- Real-time automatic task timer with Play/Pause controls.
- AI-assisted task resolution powered by Google Gemini 2.5 Pro.

### R6. Geradores de Documentos & Apresentações (`/documentos` & `/apresentacoes`)
- Document Generator: Form variables for commercial contracts and tax notices, live A4 sheet preview, and PDF export.
- Presentation Deck Generator: 7 visual themes (Profissional Azul, Moderno Escuro, Clean Muted, etc.), slide arrow navigation, and offline HTML export.

### R7. Configurações & Painel Master Super ADM (`/configuracoes` & `/super-adm`)
- Settings page for profile management, OpenRouter API keys, and Evolution WhatsApp credentials.
- Exclusive Super ADM Master Panel (`/super-adm`) for monitoring OpenRouter token usage, Stripe keys, and OmniCoin gross profit margins (85.9% – 94.3%).

---

## Acceptance Criteria

### Design System & Aesthetics
- [ ] Primary Blue (`#1E6FD9`), Dark Text (`#0F172A`), Surface Gray (`#F8FAFC`), Borders (`#E2E8F0`).
- [ ] Inter font throughout with JetBrains Mono for code.
- [ ] Zero gradients, no rounded corners > 12px (`rounded-lg`).

### Functionality & Execution
- [ ] All 7 pages (`/dashboard`, `/omni-ia`, `/financeiro`, `/whatsapp-bot`, `/tarefas`, `/documentos`, `/apresentacoes`, `/configuracoes`, `/super-adm`) are fully routable and functional.
- [ ] Role switcher in top header dynamically toggles role permissions and hides restricted sections for `funcionario`.
- [ ] `pnpm dev` builds and serves pages without TypeScript or runtime errors.

---
*Status: Ready for Launch — Awaiting User Approval*
