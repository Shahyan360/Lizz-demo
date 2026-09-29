import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function handleCreateQuoteLink(args: {
  customerName: string;
  customerEmail: string;
}): Promise<NextResponse> {
  try {
    const { customerName, customerEmail } = args;

    if (!customerName || !customerEmail) {
      return NextResponse.json({
        reply: "I need both a customer name and email to generate a quote link.",
        speakReply: "I need a customer name and email to generate a quote link.",
      });
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.quoteRequest.create({
      data: {
        token,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        expiresAt,
      },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";

    const link = `${baseUrl}/quote-builder/${token}`;

    const reply =
      `✅ **Quote link created for ${customerName}!**\n\n` +
      `📎 **Link:** [${link}](${link})\n\n` +
      `This link is valid for **7 days** and allows the customer to browse products, select what they need, and submit a quote request.\n\n` +
      `The customer can share this link — no login required. Once they submit, a draft estimate will be created in Zoho Books automatically.`;

    const speakReply = `I've created a quote link for ${customerName}. The link is valid for 7 days.`;

    return NextResponse.json({ reply, speakReply, link });
  } catch (error) {
    console.error("[Assistant Tool: create_quote_link] failed:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      reply: `⚠️ **Failed to create quote link**: ${errMsg}`,
      speakReply: "I encountered an error creating the quote link.",
      error: errMsg,
    });
  }
}
