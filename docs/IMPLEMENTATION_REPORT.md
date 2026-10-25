# Lizz public demo — implementation and verification

Date: 2026-10-25. Owner direction during implementation: launch the public demo now with working AI and realistic fictional data; exclude the old company's records and Zoho connections.

## Verdict

**READY WITH LIMITATIONS for the public demonstration. NOT READY for real customer SaaS onboarding.**

Live website: https://lizz-ai.vercel.app

Live workspace: https://lizz-ai.vercel.app/demo

Source branch: `codex/lizz-public-release` in the existing Shahyan360/ai-assistant repository. Deployed runtime source commit: `7b755ff4c22729123210d332743fb70a21bf1eb1`. Later documentation-only commits record verification evidence; they do not change the deployed runtime.

## 1. Original findings

The root is a substantial Next.js/React/TypeScript application using Prisma/MySQL, NextAuth credentials, Gemini, Qdrant, BullMQ/Redis, Zoho Mail/Books and Gmail. It includes inbox, drafting, planner, contacts, property and quotation workflows. Its shared tenant helper, globally scoped records, hardcoded fallback routing and deployment-wide provider accounts make it unsuitable for independent public customers. See the audit for evidence and the history report for the bounded exposure assessment.

## 2. Preservation

All legacy modules, migrations, private local configuration and production data remain intact for the operator. The public release does not invoke the root application, scheduler, workers, databases, mail adapters or financial handlers. No production migration, credential revocation, history rewrite, external message or financial transaction occurred.

## 3. Implemented release

`public-app/` is an independent Next.js 16.4.3 / React 19.3.1 application. It contains Lizz branding, a responsive public website, interactive overview/inbox, AI studio, editable drafts, simulated approvals, task creation/assignment/status, estimates with quantity controls and JSON export, source-document inspection, configurable local automation rules, activity, fictional team, local preferences, reset, product notes, privacy and demo terms. All visible actions operate within their disclosed scope; real integrations and customer signup are unavailable.

## 4. Sanitization

The deployed artifact contains only 30 explicitly allowlisted public source/configuration files. All public records and prompts were authored from scratch. Email addresses use reserved example domains. No old company email, contact dataset, mailbox identifiers, business documents, SMTP, database, Zoho/Gmail tokens, webhook credentials, admin passwords or financial-account credentials were uploaded. Only the owner-authorized Gemini key was reused, as a sensitive server setting. Fresh quota/cleanup secrets and a new private quota store are independent of the old system.

The preserved full repository has not been certified sanitized for new public source distribution. Its one available original commit contains contact-pattern matches in 22 files; no matching API/private-key patterns or tracked secret environment file were found by the bounded scanner. No sensitive values are repeated in reports. Ownership/IP review remains separate.

## 5. Security changes

The public backend accepts only seven fixed email IDs, three preset tones and live/sample mode. It rejects extra fields, arbitrary prompt text, customer IDs, client-selected models and requested tools/actions. Streaming JSON is capped at 1 KiB. Same-origin validation compares the public Host, including operation behind Next's internal server URL; cross-site requests are rejected. Model outputs are schema-validated and rendered as text. The server has no tool-execution or external-action layer.

Live requests reserve durable private Blob slots before a single provider call, with an output-token ceiling and timeout. Defaults are 40 calls per UTC day globally and three per visitor network. Fixed-path claims cannot overwrite each other. Missing safety configuration or storage failure prevents inference. A daily authenticated cleanup route retains at least three UTC dates of quota records. No raw network address is persisted in that store. CSP/other response headers, sanitized logs, a source privacy scan and dependency checks are included. CSP still allows inline hydration scripts/styles; no independent security certification is claimed.

## 6. Isolation and remaining tenancy work

Visitors own independent browser session objects. Versioned Zod validation rejects malformed/oversized/expired restored state. Reset aborts pending processing and replaces the object. Shared quota storage contains only empty reservation markers, not email or task data. Browser tests verified one visitor could not see another visitor's edits.

This is demo-session isolation. Organization models, customer auth, memberships, roles, cross-tenant database/vector/job enforcement and tested customer migrations have not been implemented in the narrowed release. The old root must not be exposed as a real multi-tenant product.

## 7. AI verification and model choice

The configured key passed a model-list request. A real generation call then revealed that the old `gemini-2.5-flash` model was unavailable to this account. `gemini-3.8-flash` returned a high-demand service error; another model returned a project quota error. `gemini-3.5-flash-lite` succeeded, so the public release uses that verified model through Google's Interactions API with `store:false` and minimal thinking.

Both local and deployed full workflows returned HTTP 200 with `provenance: live`, a quotation classification, two supporting sources and a generated draft. The deployed browser result contained a 663-character draft and no browser exceptions. The UI displays the actual model name. Failed model attempts were not presented as working inference; sample mode remains separately labeled.

## 8. Verification results

| Check | Actual result |
| --- | --- |
| TypeScript | Passed |
| Unit/security tests | 31 passed across four files |
| Production build | Passed locally and on Vercel |
| Source privacy/secret/import-boundary scan | 38 files checked, zero findings in the public app |
| npm audit, including development dependencies | Zero reported vulnerabilities |
| Formatting | Passed; generated Next type references are intentionally excluded |
| Local desktop/mobile browser tests | 8 passed |
| Deployed desktop/mobile browser tests | 8 passed against the public production alias |
| Browser session isolation and reset | Passed locally and deployed |
| Legacy provider/auth endpoints | Absent; tested POST requests returned 404 |
| Cleanup without its secret | HTTP 401 |
| Extra actions/arbitrary prompt/resource IDs | Rejected with HTTP 400; cross-origin requests returned 403 |
| Real Blob reservation collision | One successful claim and one rejected claim for the same path; test object removed afterward |
| Mocked concurrent quota ceiling | 25 competing claims allocated only the two available slots |
| Browser build secret scan | 15 client assets checked against four actual secret values; zero leaks |
| Deployed live AI via real browser | HTTP 200, live provenance, two sources, actual model shown, zero page exceptions |
| Post-deployment error/fatal log scan | No matching logs in the inspected 30-minute window |

The first browser test run caught an Origin/public-Host mismatch. It was fixed with a regression test; final local and production suites passed. The old model's retirement and 3.8 capacity errors were corrected by selecting the available model. Tests do not claim live Zoho, customer tenancy, SMTP, production RAG or background-worker verification.

A GitHub Actions workflow is committed for source, types, tests, formatting, dependency audit, build and browser checks. Its hosted execution result was not used as evidence; the checks above were actually run in this environment.

## 9. Production deployment

Vercel project `lizz-ai`, deployment `dpl_8xGFMRss78SBLZDR6YPicB9otCcu`, target `production`, region `sin1`, status **READY**. The remote build completed in 28 seconds. The public alias `https://lizz-ai.vercel.app` returned anonymous HTTP 200, and live inference was verified through its interface. Generated owner/preview URLs remain protected by Vercel Authentication; the production alias is public. No protection bypass or public credential link is needed.

Seven public-runtime environment keys are configured: Gemini key/model, private Blob token, quota secret, two budget settings and cleanup secret. No old provider/database environment was copied. Runtime logs are available in Vercel, but no external log drain or error-tracking integration is configured. The daily cleanup schedule is declared; its future scheduled execution has not yet been observed.

## 10. External dependencies and incomplete work

Gemini availability/quota and Vercel hosting/storage are external services. Denied inference can still incur ordinary hosting/storage operations. Daily model-call ceilings are not a currency-denominated billing guarantee. The current release has no paid plan or billing promises.

Customer signup, secure customer auth/email verification, organization creation/membership/invitation, tenant-aware persistence, customer-specific AI/RAG, real OAuth integrations, mailbox sync, real sending/finance approval, reliable tenant background jobs, commercial legal review and end-to-end multi-tenant tests remain incomplete. A separate database and Lizz-owned provider registration/consent will be required for that later release. They do not prevent use of this isolated public demo.

## 11. Commands

From the repository's `public-app/` directory:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run security:scan
npm run format:check
npm audit
npm run build
npx playwright install chromium
npm run test:e2e
```

Development serves `http://127.0.0.1:3000`. Browser tests start a production server on port 3100. To serve a local production build directly: `npm run start`. For a verified Vercel project link, run `vercel project inspect --non-interactive` and then `vercel deploy --prod` from this directory. Configure only the safe example's variables; never copy the legacy environment.

Final screenshots in `docs/screenshots/` contain only fictional product states, including a real deployed AI result. Documentation and the release checklist accurately distinguish the public demo from the incomplete customer SaaS conversion.
