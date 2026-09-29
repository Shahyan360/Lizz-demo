import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ZohoBooksService } from "@/services/zoho-books.service";

/**
 * GET /api/quote-builder/[token]/products
 * Public — returns Zoho Books products, optionally filtered by ?search=
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Validate token exists and is still active
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

    // Fetch all active products from Zoho Books
    const items = await ZohoBooksService.getItems();

    // Server-side search filtering
    const searchParam = req.nextUrl.searchParams.get("search")?.trim().toLowerCase();

    const filtered = searchParam
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(searchParam) ||
            (item.description ?? "").toLowerCase().includes(searchParam) ||
            (item.sku ?? "").toLowerCase().includes(searchParam)
        )
      : items;

    return NextResponse.json({
      products: filtered.map((item) => ({
        itemId: item.item_id,
        name: item.name,
        rate: item.rate ?? 0,
        description: item.description ?? "",
        sku: item.sku ?? "",
      })),
      total: filtered.length,
    });
  } catch (error) {
    console.error("[api/quote-builder/[token]/products] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products." },
      { status: 500 }
    );
  }
}
