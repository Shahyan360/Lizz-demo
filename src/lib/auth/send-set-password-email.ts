import { randomBytes } from "crypto";
import { prisma } from "../prisma";
import {
  appBaseUrl,
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
} from "./password-reset";
import { ZohoService } from "../../services/zoho.service";

export type SetPasswordEmailPurpose = "invite" | "reset";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailContent(
  purpose: SetPasswordEmailPurpose,
  name: string,
  resetUrl: string
): { subject: string; content: string } {
  const greeting = escapeHtml(name.trim() || "there");
  const safeUrl = escapeHtml(resetUrl);

  if (purpose === "invite") {
    return {
      subject: "You're invited to Lizzz — set your password",
      content: `
        <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
          <p>Hi ${greeting},</p>
          <p>An admin invited you to the Lizzz workspace. Choose a password to activate your account:</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
              Set password
            </a>
          </p>
          <p style="font-size:0.9em;color:#64748b;">
            This link expires in 1 hour. If you weren't expecting this invite, you can ignore this email.
          </p>
          <p style="font-size:0.8em;color:#94a3b8;word-break:break-all;">${safeUrl}</p>
        </div>
      `,
    };
  }

  return {
    subject: "Reset your Lizzz password",
    content: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
        <p>Hi ${greeting},</p>
        <p>We received a request to reset your Lizzz workspace password.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
            Reset password
          </a>
        </p>
        <p style="font-size:0.9em;color:#64748b;">
          This link expires in 1 hour. If you didn't request a reset, you can ignore this email.
        </p>
        <p style="font-size:0.8em;color:#94a3b8;word-break:break-all;">${safeUrl}</p>
      </div>
    `,
  };
}

/**
 * Creates a one-time set-password token and emails the link via Zoho.
 * Used for invites and password resets.
 */
export async function sendSetPasswordEmail(input: {
  userId: string;
  email: string;
  name?: string | null;
  purpose: SetPasswordEmailPurpose;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.passwordResetToken.deleteMany({ where: { userId: input.userId } });

  const rawToken = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({
    data: {
      userId: input.userId,
      tokenHash: hashResetToken(rawToken),
      expiresAt,
    },
  });

  const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const { subject, content } = emailContent(
    input.purpose,
    input.name ?? "",
    resetUrl
  );

  try {
    await ZohoService.sendEmail({
      toAddress: input.email,
      subject,
      content,
    });
    return { ok: true };
  } catch (err) {
    console.error("[send-set-password-email] failed:", err);
    return { ok: false, error: "Could not send the email. Check Zoho mail settings." };
  }
}

/** Random password placeholder until the user completes invite / reset. */
export function randomUnusablePassword(): string {
  return randomBytes(32).toString("base64url");
}
