# Local development

Use Node.js 24 and the committed npm lockfile. Work in `public-app/`:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Sample responses and local interactions work without any credentials. For live AI, copy `.env.example` to ignored `.env.local` and supply only your own Gemini key, a new private demo Blob store, and random demo secrets. Vercel connects the Blob store token to its project. Do not copy old company credentials.

```sh
npm test
npm run typecheck
npm run security:scan
npm run format:check
npm audit
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests use synthetic fixtures. Unit tests mock provider/storage boundaries. Browser tests use sample mode and the production build on port 3100; they do not incur model usage. For an already running deployment, set `BASE_URL` before `npm run test:e2e`.

The preserved root app has its own dependencies and infrastructure. It is not required to develop or run the public demo. Do not start its workers or migrations when testing the public release.
