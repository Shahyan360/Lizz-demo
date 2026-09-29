import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth/options";
import { prisma } from "../../../../../lib/prisma";
import { CryptoService } from "../../../../../services/crypto.service";
import { GmailService } from "../../../../../services/gmail.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (error || !code) {
    console.error("[OAuth Callback] Authorization error or missing code:", error);
    return NextResponse.redirect(new URL("/?oauth_error=access_denied", appUrl));
  }

  try {
    const tokens = await GmailService.exchangeCodeForTokens(code);
    const profile = await GmailService.getUserProfile(tokens.accessToken);
    const email = profile.emailAddress;

    const encryptedAccess = CryptoService.encrypt(tokens.accessToken);
    const encryptedRefresh = CryptoService.encrypt(tokens.refreshToken);
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    const isFirstAccount = (await prisma.gmailAccount.count()) === 0;

    await prisma.gmailAccount.upsert({
      where: { email },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiry,
        syncStatus: "IDLE",
      },
      create: {
        email,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiry,
        syncStatus: "IDLE",
        isActive: isFirstAccount,
      },
    });

    console.log(
      `[OAuth Callback] Mailbox ${email} linked (active=${isFirstAccount}).`
    );

    return NextResponse.redirect(new URL("/?oauth_success=true", appUrl));
  } catch (err) {
    console.error("[OAuth Callback] Unexpected error during OAuth code exchange:", err);
    return NextResponse.redirect(
      new URL("/?oauth_error=exchange_failed", appUrl)
    );
  }
}
