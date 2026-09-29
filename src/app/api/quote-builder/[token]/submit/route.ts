import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ZohoBooksService } from "@/services/zoho-books.service";
import { z } from "zod";

const submitSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, "At least one product must be selected."),
});

/**
 * POST /api/quote-builder/[token]/submit
 * Public — creates a Zoho Books estimate draft from the customer's product selections.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Validate token
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { token },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found." },
        { status: 404 }
      );
    }

    if (
      quoteRequest.expiresAt < new Date() ||
      quoteRequest.status === "EXPIRED"
    ) {
      return NextResponse.json(
        { error: "This quote request has expired." },
        { status: 410 }
      );
    }

    if (
      quoteRequest.status === "QUOTED" ||
      quoteRequest.status === "SUBMITTED"
    ) {
      return NextResponse.json(
        { error: "This quote has already been submitted." },
        { status: 410 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    // Mark as submitted immediately to prevent double-submission
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: { status: "SUBMITTED" },
    });

    // Find or create customer in Zoho Books
    const customerId = await ZohoBooksService.findOrCreateContact(
      quoteRequest.customerName,
      quoteRequest.customerEmail
    );

    // Create Zoho Books estimate as draft
    const lineItems = parsed.data.items.map((item) => ({
      item_id: item.itemId,
      quantity: item.quantity,
    }));

    const estimate = await ZohoBooksService.createEstimate(
      customerId,
      lineItems
    );

    // Email the estimate quotation to the customer
    try {
      console.log(`[Quote Builder Submit] Emailing estimate ${estimate.estimate_number} to ${quoteRequest.customerEmail}`);
      await ZohoBooksService.sendEstimateEmail(
        estimate.estimate_id,
        quoteRequest.customerEmail
      );
    } catch (emailErr) {
      console.error("[Quote Builder Submit] Failed to send estimate email:", emailErr);
      // We still proceed since the estimate draft is successfully created in Zoho Books
    }

    // Update quote request with Zoho estimate ID
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: {
        status: "QUOTED",
        zohoEstimateId: estimate.estimate_id,
      },
    });

    return NextResponse.json({
      success: true,
      estimateNumber: estimate.estimate_number,
      total: estimate.total,
      message:
        "Your quote request has been submitted successfully! Our team will review it and get back to you shortly.",
    });
  } catch (error) {
    console.error("[api/quote-builder/[token]/submit] error:", error);

    // Revert to PENDING on failure so the customer can retry
    try {
      const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { token: params.token },
      });
      if (quoteRequest?.status === "SUBMITTED") {
        await prisma.quoteRequest.update({
          where: { id: quoteRequest.id },
          data: { status: "PENDING" },
        });
      }
    } catch {
      // Ignore revert errors
    }

    return NextResponse.json(
      { error: "Failed to create quote. Please try again." },
      { status: 500 }
    );
  }
}
