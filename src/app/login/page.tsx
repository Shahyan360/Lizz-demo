import { LoginForm } from "./LoginForm";

/**
 * /login — the only page reachable while signed out. Reads an optional
 * `callbackUrl` (set by middleware when it bounces an unauthenticated request)
 * and hands it to the client form, so users land back where they were headed.
 */
export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const raw = searchParams.callbackUrl;
  // Only honor same-origin relative paths — never an absolute external URL.
  const callbackUrl = raw && raw.startsWith("/") ? raw : "/";
  return <LoginForm callbackUrl={callbackUrl} />;
}
