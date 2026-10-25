# Public runtime configuration

Use `public-app/.env.local` locally and Vercel encrypted/sensitive variables in hosted environments. `.env.local`, `.vercel`, build outputs and test traces are excluded from commits and source uploads. Never copy the root `.env`.

| Variable | Purpose | Missing behavior |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server-only Google Gemini API key. First configured key is used; no automatic key rotation/retries. | Live inference unavailable; sample mode still works. |
| `LLM_MODEL` | Provider model ID. Default `gemini-3.5-flash-lite`; server configuration only. The old 2.5 model rejected generation for this account and 3.8 reported high demand. | Default is used. |
| `BLOB_READ_WRITE_TOKEN` | Newly provisioned private demo-only Blob store token. | Live inference fails closed. |
| `DEMO_QUOTA_SECRET` | Fresh random secret of at least 32 characters for daily keyed network hashes. | Live inference fails closed. |
| `DEMO_DAILY_BUDGET` | Whole-demo provider-call slots per UTC day. Default 40, hard maximum 100. | Default applies. |
| `DEMO_VISITOR_DAILY_BUDGET` | Slots per network per UTC day. Default 3, hard maximum 5. | Default applies. |
| `CRON_SECRET` | Fresh random secret of at least 32 characters for cleanup authorization. | Cleanup rejects all requests. |
| `VERCEL` | Set by Vercel; selects trusted platform IP-header and HTTPS handling. Do not manually spoof locally. | Local requests share a `local` quota identity. |

No `NEXT_PUBLIC_` credential is used. No Zoho, Gmail, SMTP, database, old encryption/admin secret or webhook secret is needed or accepted by public application code. The health route exposes only booleans and release mode, never values. A populated key is configuration evidence; only a successful inference establishes provider functionality.
