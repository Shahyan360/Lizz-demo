/**
 * Next.js configuration.
 *
 * Adds baseline security response headers on every route. (No Content-Security-
 * Policy yet: the UI relies heavily on inline styles and sandboxed srcdoc
 * iframes for email bodies, so a strict CSP needs dedicated work to avoid
 * breaking rendering — tracked as a follow-up.)
 */
const securityHeaders = [
  // Clickjacking: don't allow the app to be framed by other origins.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Don't let browsers MIME-sniff responses into an unexpected content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Trim the Referer sent to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop access to powerful features the app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
  },
  // Force HTTPS for two years once served over TLS (ignored on plain HTTP).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained production server under `.next/standalone` (server.js
  // + only the node_modules actually traced as used). This is what the Docker
  // image copies, keeping the runtime layer small and free of dev/build deps.
  output: "standalone",
  // Required on Next 14 for `src/instrumentation.ts`'s register() hook to run
  // (stable without this flag starting Next 15). That hook boots the
  // in-process property follow-up scheduler on server start.
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
