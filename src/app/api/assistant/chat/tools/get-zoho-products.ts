import { NextResponse } from "next/server";
import { ZohoBooksService } from "@/services/zoho-books.service";
import type { ZohoBooksItem } from "@/lib/schemas/zoho-books";

export async function handleGetZohoProducts(): Promise<NextResponse> {
  try {
    const items = await ZohoBooksService.getItems();
    if (items.length === 0) {
      return NextResponse.json({
        reply: "I checked Zoho Books, but there are currently **no active products** found.",
        speakReply: "I checked Zoho Books, but no active products were found.",
        items: [],
      });
    }

    // Generate markdown list of products
    const mdLines = items.map((item: ZohoBooksItem) => {
      const rateText = item.rate !== undefined ? `$${item.rate.toFixed(2)}` : "No price set";
      const descText = item.description ? ` - *${item.description}*` : "";
      const skuText = item.sku ? ` [SKU: ${item.sku}]` : "";
      return `- **${item.name}** (${rateText})${skuText}${descText}`;
    });

    const reply = `**Active Products from Zoho Books**:\n\n${mdLines.join("\n")}`;
    const speakReply = `I found ${items.length} active products in Zoho Books.`;

    return NextResponse.json({
      reply,
      speakReply,
      items,
    });
  } catch (error) {
    console.error("[Assistant Tool: get_zoho_products] failed:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      reply: `⚠️ **Failed to fetch products from Zoho Books**: ${errMsg}`,
      speakReply: "I encountered an error trying to fetch products from Zoho Books.",
      error: errMsg,
    });
  }
}
