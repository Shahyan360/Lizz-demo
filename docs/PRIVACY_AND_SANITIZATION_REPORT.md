# Privacy and sanitization report

## Scope and owner direction

The owner asked to launch the public demo now using realistic fictional records and to exclude company/personal records and Zoho connections. The deployment boundary is `public-app/` only. Existing production data, credentials and shared Git history were not deleted, revoked or rewritten.

## Findings without sensitive values

The original source contains hardcoded personal fallback routing, named business handlers, company/industry assumptions, writing samples and global provider configuration. Its business records lack organization boundaries. Its local ignored environment contains real integration configuration and is not a deployable public example.

The one available historical commit contains 365 tracked paths. A pattern-based content scan detected no matching API/private-key patterns, no tracked non-example environment file and no matching private document/dump/log extensions. It identified non-example contact patterns in 22 files; some may be dependency author metadata or test placeholders. File-only findings are in `HISTORY_SCAN.json`. This is a bounded assessment of the available history, not a guarantee of absence or legal ownership clearance.

## Remediation

* Authored all public emails, names, organizations, reference documents, products, prices and orders from scratch. Contact domains are reserved examples.
* Isolated all deployment source, package dependencies, prompts and configuration from legacy code. Neither the old database nor vectors are read.
* Deployed no Zoho/Gmail OAuth credentials, refresh/access tokens, mailbox IDs, accounting IDs, SMTP, fallback recipients, company documents, provider webhook routes, old admin settings or schedulers.
* Reused only the specifically authorized Gemini API key as a sensitive server environment value. The key's value is not in source, screenshots, reports or client code. New quota/cleanup secrets are independent of old authentication/encryption secrets.
* Created a new private demo-only quota store, storing only empty reservation markers under daily keyed network hashes.
* Added a secret/domain/import-boundary release scan and excluded local environments, dependencies, build outputs and browser traces from source upload.

The complete legacy source is retained locally/in the existing repository for the operator. It has **not** been certified sanitized for new public source distribution. The Vercel source upload is a separate reviewed artifact, not the entire repository. Owner/IP review and any wider history remediation remain separate work. There is no reason to rotate an old credential based solely on the absence of a scanner match; any independently confirmed exposure still requires rotation through its provider.
