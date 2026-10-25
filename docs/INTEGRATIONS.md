# Integration status

| Integration | Public demo state |
| --- | --- |
| Google Gemini | Implemented server-side structured classification/extraction/drafting through the stateless Interactions API. The verified available default is `gemini-3.5-flash-lite`; the old 2.5 model rejected generation and 3.8 reported high demand. Live inference evidence is recorded in the implementation report. |
| Vercel private Blob | Implemented durable inference quota markers and authenticated retention cleanup. No business records stored here. |
| Zoho Mail | Not connected. No tokens, OAuth routes, mail sync or sending handlers deployed. |
| Zoho Books | Not connected. Fictional local estimates only; no transactions or finance API deployed. |
| Gmail / Google Workspace | Not connected. The demo inbox is synthetic. |
| Microsoft 365 | Future integration; not implemented. |
| Qdrant | Not connected in public runtime. Fixed fictional context only. |
| MySQL / Redis / BullMQ | Legacy modules preserved outside the public runtime; not used by the demo. |

The original root Zoho adapters remain for the operator. Their deployment-wide credentials, token caches and global account context are not reusable as customer-scoped integrations without refactoring.

A later real-account release needs a Lizz-owned provider registration and user consent, minimum scopes, region allowlists, one-time user/session/organization-bound OAuth state, encrypted per-organization tokens, mailbox ownership verification, refresh/disconnect handling, authenticated webhooks, audit and separate integration testing. No account was disconnected or revoked during this public-demo release.
