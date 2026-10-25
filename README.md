# Lizz

Lizz is an AI email operations product, formerly named Maxine. The public release lives in **`public-app/`**. It is a separate, sanitized Next.js application with an interactive fictional workspace and bounded live Gemini inference.

The older application remains at the repository root for its operator. Do not deploy that root as the public product: its original schema and integrations are not safe for independent customer organizations. Public deployment uploads only `public-app/`; it imports no root modules or credentials.

## Public demo

From `public-app/`:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run security:scan
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run dev` binds to `127.0.0.1:3000`. Browser tests start the production build on port 3100. To try live AI locally, configure only the variables in `public-app/.env.example` in its own ignored `.env.local`. The demo works with clearly disclosed sample responses without any credentials.

Implemented: fictional inbox and threads; live Gemini classification, extraction and contextual drafts; editable replies and simulated approval; tasks and assignment; fictional estimates and JSON export; source inspection; simulated automation rules; activity; local settings; responsive layouts; session reset; privacy and product notes. Limits default to 40 provider requests per UTC day across the demo and three per network. All outbound email and financial operations are absent.

Customer signup, customer organizations, invitations, live Zoho/Gmail/Books integrations, production RAG, billing and tenant-aware workers are **not released**. The public demo is not a multi-tenant production SaaS.

Read [the audit](docs/PUBLIC_RELEASE_AUDIT.md), [architecture](docs/ARCHITECTURE.md), [demo design](docs/DEMO_MODE.md), [deployment guide](docs/DEPLOYMENT.md), [sanitization report](docs/PRIVACY_AND_SANITIZATION_REPORT.md), and [implementation evidence](docs/IMPLEMENTATION_REPORT.md).

## Preserved original application

The root contains Next.js/React, Prisma/MySQL, NextAuth, BullMQ/Redis, Qdrant, Gmail, Zoho Mail/Books, drafting, planner, contacts, property and quote workflows. They are preserved in source, excluded from public deployment, and have not been live-tested or converted to customer tenancy. No old database was migrated or deleted, no external messages were sent and no old credentials were revoked.

Do not copy the root `.env`, legacy writing samples, business records or old provider tokens into the public deployment. Never rewrite shared history or publish client-owned source/assets without a separate owner review. History scan findings omit sensitive values.
