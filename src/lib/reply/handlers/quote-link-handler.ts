import type { GeneratedReply } from "../types";
import { createQuoteLinkSchema } from "../router-tool";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function handleCreateQuoteLinkEmailTool(
  args: unknown,
  customerName?: string,
  customerEmail?: string
): Promise<GeneratedReply> {
  const parsed = createQuoteLinkSchema.parse(args);

  const effectiveName =
    parsed.customerName?.trim() || customerName?.trim() || "Valued Customer";
  const effectiveEmail =
    parsed.customerEmail?.trim() || customerEmail?.trim() || "";

  let replyText = parsed.emailDraft;

  if (effectiveEmail) {
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await prisma.quoteRequest.create({
        data: {
          token,
          customerName: effectiveName,
          customerEmail: effectiveEmail.toLowerCase(),
          expiresAt,
        },
      });

      const baseUrl =
        process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
        process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
        "http://localhost:3000";

      const link = `${baseUrl}/quote-builder/${token}`;
      const firstName = effectiveName.split(" ")[0].trim();
      const greeting = firstName ? `Hi ${firstName},\n\n` : "Hi,\n\n";

      replyText = `${greeting}Thanks for reaching out about your project. To get you a price estimate as quickly as possible, we've created a personalized Quote Builder link where you can browse our catalog and select the products you need:\n\n${link}\n\nOnce you submit your selections, a draft quotation will be generated in Zoho Books and emailed to you automatically.\n\nIf you have any questions or photos to share, feel free to reply directly to this email.\n\nBest regards,\nLizzz`;
    } catch (dbErr) {
      console.error("[quote-link-handler] Failed to create quote link in DB:", dbErr);
    }
  }

  return {
    replyText,
    followUp: [
      `Quote Builder link generated for ${effectiveName} (${effectiveEmail || "no email"}) — valid for 7 days.`,
    ],
  };
}
