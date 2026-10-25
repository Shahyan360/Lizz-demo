# Contributing to Lizz

This repository is private. Keep original company information private, and work inside `public-app/` for changes to the public demonstration unless a change explicitly requires another area.

## Workflow

1. Create a focused branch from the latest `main`.
2. Install and run the demo from `public-app/` using Node.js 24 and `npm ci`.
3. Keep fixtures fictional and use reserved example email domains.
4. Run the checks below and describe the change, validation, and limitations in the pull request.

```sh
cd public-app
npm run typecheck
npm test
npm run security:scan
npm run format:check
npm audit
npm run build
npx playwright install chromium
npm run test:e2e
```

## Boundaries

- Do not copy the original environment, mail records, documents, tokens, or account IDs into the public app.
- Never commit secrets, local build outputs, or credential-bearing screenshots/traces.
- Do not import original integrations, schedulers, databases, or workers into the public runtime.
- Preserve human review and honest live/sample provenance.
- Keep product claims consistent with working code.
- Test quota changes under concurrency and fail closed when safety configuration is absent.

Production migrations, real mailbox/financial actions, credential rotation, or history rewriting require separately scoped work. Read [the architecture](docs/ARCHITECTURE.md), [security notes](docs/SECURITY.md), and [release checklist](docs/RELEASE_CHECKLIST.md) before changing those boundaries.

For product captures, follow the [screenshot guidelines](docs/SCREENSHOTS.md#capture-guidelines).
