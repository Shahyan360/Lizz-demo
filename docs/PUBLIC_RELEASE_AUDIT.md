# Lizz public-release audit

Audit date: 2026-10-25. Baseline: `f2be9f0`, the only commit available from the matching Shahyan360/ai-assistant repository. Work branch: `codex/lizz-public-release`.

## Verified architecture

The legacy root is a Next.js 14 / React 18 / TypeScript application with NextAuth credentials authentication, bcrypt, Prisma/MySQL, Redis/BullMQ, Qdrant, Gemini through an OpenAI-compatible client, Gmail and Zoho Mail/Books integrations. Existing views include mailbox, planner, contacts, companies, property qualification, quote builder, drafts, and administration. Docker Compose defines MySQL, Redis and Qdrant; CircleCI targets a separate container deployment. No Vercel project for this application existed in the connected team at inspection.

Email pipeline: provider webhook/sync -> spam/blocklist screening -> email persistence -> classification/context retrieval -> parsing/reasoning/mimic orchestration -> draft and proposed actions -> review/send adapters. BullMQ also runs pipeline jobs; a startup hook starts a property follow-up scheduler. Specialized handlers include property, quote, scheduling and team routing. These modules are present in source; this audit does not establish that live mail, Books or worker operations succeed.

## Release blockers discovered

* The Prisma schema has no organization ownership fields on business records. A historical migration explicitly removed tenancy. `getOrCreateTenant` returns a shared synthetic ID. Global role ADMIN/USER does not enforce independent customer boundaries.
* Team-member defaults include a personal fallback address. Business prompts, writing samples and property workflows contain industry/client assumptions. Public redistribution of those assets requires owner review.
* Existing Zoho configuration is deployment-wide; demo access to those handlers would expose or affect the old account. Gmail tokens are stored as text in the original schema.
* Pipeline jobs lack trusted organization context; vector retrieval and cache use must not be treated as tenant-safe.
* Legacy startup hooks and cron endpoints may cause external side effects. Authentication alone cannot make the existing application safe for multiple businesses.
* Development Compose publishes data-service ports and uses development passwords. These are unsuitable production defaults.
* The existing Gemini key passed a read-only model-list request. The configured model is `gemini-2.5-flash`. No credential values are included in this report.
* `.env` is ignored and was not tracked in the one available commit. SQL migration files are present; they require content scanning, not an assumption that they are customer dumps. Repository-wide sanitization/history scanning is recorded separately.

## Implementation boundary

Preserve the original application and migrations for its current operator. Build the public runtime under `public-app/` with its own dependency lockfile, Prisma schema, credentials and deployment root. This boundary prevents accidentally bundling legacy routes, schedulers, prompts, documents or provider accounts. It is an incremental replacement, not a claim that legacy modules have become multi-tenant.

Public demo must run without MySQL, Redis, Qdrant, Zoho, SMTP or any old account credentials. Live AI is limited to server-selected synthetic fixtures. Real workspaces must fail closed unless an independently configured database, auth email delivery and encryption key are available. No migration is authorized against the old database.

## Acceptance evidence

See `RELEASE_CHECKLIST.md` and `IMPLEMENTATION_REPORT.md` for checks actually run, deployment evidence, remaining work and the final release verdict. Real Zoho OAuth consent, live email synchronization, database migration execution, SMTP delivery and customer onboarding must not be marked verified without their separate infrastructure.
