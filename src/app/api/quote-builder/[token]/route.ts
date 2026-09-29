import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/quote-builder/[token]
 * Public — validates the token and returns customer info + status.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { token },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found." },
        { status: 404 }
      );
    }

    if (quoteRequest.expiresAt < new Date()) {
      // Auto-mark as expired if not already
      if (quoteRequest.status === "PENDING") {
        await prisma.quoteRequest.update({
          where: { id: quoteRequest.id },
          data: { status: "EXPIRED" },
        });
      }
      return NextResponse.json(
        { error: "This quote request has expired." },
        { status: 410 }
      );
    }

    if (quoteRequest.status === "QUOTED") {
      return NextResponse.json(
        {
          error: "This quote has already been submitted and processed.",
          status: quoteRequest.status,
        },
        { status: 410 }
      );
    }

    if (quoteRequest.status === "SUBMITTED") {
      return NextResponse.json(
        {
          error: "This quote has already been submitted. We are processing it.",
          status: quoteRequest.status,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      customerName: quoteRequest.customerName,
      customerEmail: quoteRequest.customerEmail,
      status: quoteRequest.status,
      expiresAt: quoteRequest.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/quote-builder/[token]] error:", error);
    return NextResponse.json(
      { error: "Failed to validate quote request." },
      { status: 500 }
    );
  }
}
