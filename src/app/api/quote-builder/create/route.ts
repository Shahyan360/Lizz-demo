import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/**
 * POST /api/quote-builder/create
 * Protected — creates a new QuoteRequest with a unique token.
 * Body: { customerName: string, customerEmail: string, expiresInDays?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerEmail, expiresInDays = 7 } = body;

    if (!customerName || !customerEmail) {
      return NextResponse.json(
        { error: "customerName and customerEmail are required." },
        { status: 400 }
      );
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const quoteRequest = await prisma.quoteRequest.create({
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

    return NextResponse.json({
      id: quoteRequest.id,
      token,
      link,
      expiresAt: quoteRequest.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/quote-builder/create] error:", error);
    return NextResponse.json(
      { error: "Failed to create quote request." },
      { status: 500 }
    );
  }
}
