# Release checklist

## Public demo gate

- [x] Lizz branding and newly authored fictional records.
- [x] Independent deployment source boundary.
- [x] Old mail, database, vectors, financial writes and credentials excluded.
- [x] Interactive inbox, source inspection, drafts, tasks, reviews and reset.
- [x] No fake working integrations or live customer signup.
- [x] Honest live/sample AI provenance and provider failure handling.
- [x] Durable global/per-network inference ceiling with concurrent-claim tests.
- [x] Request/response validation, same-origin checks and safe text rendering.
- [x] Unit/security tests, type checking, dependency audit and source scan.
- [x] Desktop/mobile browser tests passing after final code changes (8 local, 8 deployed).
- [x] Live inference verified through the deployed server (HTTP 200, Gemini 3.5 Flash Lite).
- [x] Production deployment READY and public alias tested anonymously (`https://lizz-ai.vercel.app`).
- [x] Client build checked for four actual credential values (15 assets, zero leaks).

The implementation report records final evidence and replaces pending entries when verified.

## Customer SaaS gate — NOT OPEN

- [ ] Separate business database and tested migrations.
- [ ] Maintained customer auth, email verification, secure sessions and onboarding.
- [ ] Enforced organization ownership, memberships and roles across all records.
- [ ] Two-tenant IDOR/API/file/vector/job isolation tests.
- [ ] Organization-owned, encrypted provider connections and OAuth lifecycle.
- [ ] Verified real mailbox/Books workflows, review enforcement and safe sending.
- [ ] Tenant-aware RAG, background processing, quotas and recovery.
- [ ] Data retention/deletion, full commercial privacy/terms and owner/IP review.

A public demo release is not evidence that these customer-SaaS gates are complete.
