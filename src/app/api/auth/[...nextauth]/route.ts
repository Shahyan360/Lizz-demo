import NextAuth from "next-auth";
import { authOptions } from "../../../../lib/auth/options";

/**
 * NextAuth catch-all handler: /api/auth/signin, /session, /callback/credentials,
 * /signout, /csrf, etc. The pre-existing explicit routes /api/auth/gmail and
 * /api/auth/callback/gmail take precedence over this catch-all, so the Gmail
 * OAuth flow is unaffected.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
