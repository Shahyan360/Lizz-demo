# Deployment

Deploy `public-app/` to Vercel project `lizz-ai`, in the verified connected owner team. Never upload the parent directory or point Vercel at the legacy root.

The initial release uses the authenticated Vercel connector: create a Next.js project, create a new private Blob store attached to that project, add the six approved AI/quota settings as sensitive/plain server variables as appropriate, upload an explicit source-file allowlist, create a production deployment and inspect its build status. Post-deploy checks must use the actual production alias anonymously to establish public accessibility.

For subsequent CLI deployment, explicitly link only the verified project, inspect context from `public-app/`, and then deploy:

```sh
vercel project inspect --non-interactive
vercel deploy --prod
```

For Git-based automatic deployments, configure Root Directory `public-app` and confirm the production branch before enabling it. This release does not push to or overwrite the operator's main branch, and does not enable the legacy CircleCI deployment.

Vercel uses the committed lockfile and `npm run build`. Node.js 24 and the Singapore function region are configured. The AI route allows 60 seconds total; provider inference itself is limited to 22 seconds. A Vercel daily cron invokes `/api/cleanup` with `CRON_SECRET`, retaining at least three UTC dates of quota reservations. Missing cleanup credentials reject requests. Missing inference safety configuration disables live AI while leaving sample mode available.

No migration or root Docker container is required. The legacy Compose stack must not be exposed publicly or reused for this demo. No old database backups or mail data are uploaded.

## Verification and recovery

Check `/`, `/demo`, `/privacy`, `/docs`, `/api/health`, same-origin sample processing and one live inference. Confirm arbitrary payloads are rejected and legacy provider routes are absent. Test desktop/mobile layouts, reset, session isolation and approval semantics. Inspect browser bundles for actual secret values.

If a deployment fails, leave the last verified production alias in place. For regressions use Vercel's known-good deployment promotion/rollback after inspecting its target. This demo has no database migration rollback. Quota markers need no backup; never delete current-day slots to bypass spending ceilings. UI state is intentionally disposable. Do not print environment values or download provider auth credentials into reports.
