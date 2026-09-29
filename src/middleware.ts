import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function sessionCheckUrl(reqUrl: string): URL {
  const internal = process.env.NEXTAUTH_URL_INTERNAL?.trim();
  if (internal) {
    return new URL("/api/auth/session-check", internal.replace(/\/$/, ""));
  }
  return new URL("/api/auth/session-check", reqUrl);
}

export default withAuth(
  async function middleware(req) {
    try {
      const check = await fetch(sessionCheckUrl(req.url), {
        headers: { cookie: req.headers.get("cookie") ?? "" },
      });

      if (!check.ok) {
        if (req.nextUrl.pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Unauthorized — session expired or invalid" },
            { status: 401 }
          );
        }
        const login = new URL("/login", req.url);
        login.searchParams.set("callbackUrl", req.nextUrl.pathname);
        return NextResponse.redirect(login);
      }
    } catch (error) {
      console.error("[middleware] session-check fetch failed:", error);
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized — session check failed" },
          { status: 401 }
        );
      }
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(login);
    }

    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!login|forgot-password|reset-password|api/auth|api/cron|api/zoho/webhook|api/zoho/forms-webhook|api/zoho/reply-preview|quote-builder|api/quote-builder/(?!create)|_next/static|_next/image|favicon.ico).*)",
  ],
};
