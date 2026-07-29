# OmniZeus — Standalone E2E Testing Framework & Mock Infrastructure (TEST_INFRA.md)

## Executive Overview
The OmniZeus E2E Testing Track provides a fully automated, standalone, zero-network test suite and verification engine. It guarantees 100% test coverage across features R1 through R7 without relying on external cloud APIs or databases.

---

## 1. Architectural Design & Zero-Network Guarantee

### 1.1 Opaque-Box Test Architecture
The test framework intercepts and mocks all outbound HTTP/HTTPS requests at the network layer:
- **Supabase Auth & PostgreSQL REST DB**: In-memory state machine for user authentication, token issuance/validation, and database CRUD tables (`users`, `conversations`, `messages`, `webhook_logs`, `user_settings`).
- **LLM Streaming Providers**: SSE streaming response emulation for OpenAI (GPT-4o), Anthropic (Claude Sonnet), and Google Gemini (1.5 Pro) with rate limit (HTTP 429) simulation and Brazilian accounting context verification.
- **Evolution API (WhatsApp)**: Instance management (`/instance/create`), QR code polling (`/instance/connectionStatus/{instance}`), and webhook ingestion (`POST /api/webhook/whatsapp`).
- **ContaAzul OAuth 2.0 & API v2**: OAuth login redirect, authorization code exchange, refresh token handling, CSRF state verification, and financial summary endpoints (`Contas a Pagar`, `Contas a Receber`, `NFe Emitidas`).

### 1.2 Network Tracker & Isolation Engine
Every outbound HTTP call is captured by `NetworkTracker`. Any call targeting an un-mocked external domain triggers an immediate test execution failure.

---

## 2. Automated Design System Verification Engine

The `DesignSystemValidator` automatically inspects component styles and text nodes:
- **Primary Color**: `#1E6FD9` (`rgb(30, 111, 217)`)
- **Primary Hover/Lt**: `#4A90E2` (`rgb(74, 144, 226)`)
- **Surface Background**: `#F8FAFC` (`rgb(248, 250, 252)`)
- **Card Background**: `#FFFFFF` (`rgb(255, 255, 255)`)
- **Borders & Dividers**: `#E2E8F0` (`rgb(226, 232, 240)`)
- **Text Dark**: `#0F172A` (`rgb(15, 23, 42)`)
- **Text Muted**: `#64748B` (`rgb(100, 116, 139)`)
- **Typography**: Inter font throughout, JetBrains Mono for code blocks.
- **Strict Prohibition Assertions**:
  1. No gradients (`linear-gradient` / `radial-gradient`) in `background-image`.
  2. Container `border-radius` capped at `12px` (0.75rem).
  3. `box-shadow` capped at `shadow-md` limits.
  4. Zero raw unicode emojis (`/\p{Extended_Pictographic}/u`) in UI text nodes (must use Lucide SVG icons).

---

## 3. Directory Structure & Test Suite Layout

```
c:\Users\jessica\Desktop\MVP\
├── package.json                          # NPM scripts ("test:e2e": "node scripts/run-e2e-tests.js")
├── TEST_INFRA.md                         # Infrastructure architecture specification
├── TEST_READY.md                         # Test readiness checklist and tier breakdown report
├── scripts/
│   └── run-e2e-tests.js                  # Standalone executable test runner (98 test cases)
└── tests/
    └── e2e/
        ├── fixtures/
        │   ├── mock-services.js          # Zero-network stateful mock handlers
        │   └── mock-services.ts          # TypeScript re-export header
        ├── utils/
        │   ├── design-system-validator.js# Automated Design System checker engine
        │   └── design-system-validator.ts# TypeScript re-export header
        ├── tier1-feature-coverage.spec.js / .ts   # Tier 1 (42 Test Cases)
        ├── tier2-boundary-corner.spec.js / .ts    # Tier 2 (42 Test Cases)
        ├── tier3-cross-feature.spec.js / .ts      # Tier 3 (8 Test Cases)
        └── tier4-real-world-workflows.spec.js / .ts # Tier 4 (6 Test Cases)
```

---

## 4. Execution Commands

To run the complete 98-case test suite with zero-network verification and Design System audit:

```bash
npm run test:e2e
# OR
node scripts/run-e2e-tests.js
```
