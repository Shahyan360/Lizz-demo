# Lizz public demo

The independently deployable, sanitized public product. See the repository `docs/` for the audit, architecture, privacy, release limitations and verification evidence.

## Start

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Sample mode requires no database, account or provider configuration. Live AI requires the server-only settings documented in `.env.example`. Do not copy a legacy environment file.

## Check

```sh
npm run typecheck
npm test
npm run security:scan
npm run format:check
npm audit
npm run build
npx playwright install chromium
npm run test:e2e
```

## Deploy

Deploy **this directory only** to the verified Vercel project. Use `vercel project inspect --non-interactive` to check context before `vercel deploy --prod`. The initial release uses authenticated Vercel tools and an explicit allowlist of these source files; it does not upload the parent repository. Vercel production variables must contain only the AI key/model, a new demo-only private Blob token and fresh demo quota/cleanup secrets.

No customer authentication, real integrations, mail delivery, financial writes, database or worker process is included. This is a public demo with live AI, not a production customer workspace.
