# Public-demo security

Implemented boundaries:

* Independent deployment root and explicit source-upload allowlist. No legacy source routes, company records or provider secrets in the distribution.
* API keys in server-only sensitive environment variables. Browser bundle inspection must confirm absence of their values.
* Strict JSON request schema; 1 KiB streaming body limit; same-origin Host validation; cross-site request rejection. No arbitrary text, model selection, organization IDs, tool definitions or external destinations accepted.
* Fixed synthetic context, constrained structured Gemini output, Zod response validation, 1,500 output tokens, one provider attempt and a 22-second timeout. Invalid output fails safely.
* Private durable quota slots reserved before inference, including global and per-network ceilings. Concurrent claims cannot overwrite a slot. Storage/configuration failure prevents provider calls. Failed calls consume slots rather than enabling retries outside the budget.
* No real outbound emails or financial actions; fixed human review applies independently of confidence/rules.
* React text rendering rather than untrusted HTML. Security headers deny framing, limit resources and apply HTTPS protections. Next hydration requires inline scripts/styles, so CSP currently allows them; this is a documented limitation.
* Versioned validated per-tab state, independent session objects, reset and expiry on restoration. No API returns another visitor's state.
* Logs record coarse events/categories only. Quota storage hashes daily network identity; scheduled authenticated cleanup deletes old markers.
* Production dependency audit, secret-pattern scan and security tests in CI.

Remaining limitations: no independent penetration test or compliance certification; demo UI controls are simulations; per-network quotas can be shared by visitors behind one NAT and do not prevent a distributed denial of service; Vercel's normal DDoS protections apply, while a custom WAF policy has not been enabled. Blob operations/hosting are still infrastructure usage even when inference is denied. The fixed provider-call ceiling is not a currency billing guarantee. Provider pricing, platform quotas and owner spend settings remain external.

The legacy root remains unsuitable as public multi-tenant SaaS. Source-history contact matches require owner review before a sanitized public source publication. Pattern scanning does not prove that no historical secret exists, and deleting a secret from source would not revoke it. No shared history was rewritten and no credential rotation occurred.
