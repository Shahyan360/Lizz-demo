import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { validateUserSession } from "../../../../lib/auth/session-version";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session-check — lightweight JWT + DB validation for middleware.
 * Returns 200 when the session is still active; 401 when revoked or stale.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.uid || typeof token.sessionVersion !== "number") {
    return new Response(null, { status: 401 });
  }

  const valid = await validateUserSession(token.uid, token.sessionVersion);
  if (!valid.ok) {
    return new Response(null, { status: 401 });
  }

  return new Response(null, { status: 200 });
}
