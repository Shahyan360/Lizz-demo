import { NextResponse } from "next/server";
import { ZohoBooksService } from "@/services/zoho-books.service";

interface QuoteItemInput {
  itemId: string;
  quantity: number;
  rate?: number;
}

export async function handleCreateZohoQuote(args: {
  customerName: string;
  customerEmail: string;
  items: QuoteItemInput[];
}): Promise<NextResponse> {
  const { customerName, customerEmail, items } = args;

  if (!customerName || !customerEmail || !items || items.length === 0) {
    return NextResponse.json({
      reply: "⚠️ **Invalid input**: Customer name, customer email, and at least one item are required to create a quotation.",
      speakReply: "I couldn't create the quote because some customer or item details are missing.",
    });
  }

  try {
    // 1. Resolve or create customer contact in Zoho Books
    console.log(`[Assistant Tool: create_zoho_quote] Resolving contact for: ${customerEmail}`);
    const contactId = await ZohoBooksService.findOrCreateContact(customerName, customerEmail);
    console.log(`[Assistant Tool: create_zoho_quote] Contact resolved to ID: ${contactId}`);

    // 2. Map line items to Zoho Books format
    const lineItems = items.map((item) => ({
      item_id: item.itemId,
      quantity: item.quantity,
      rate: item.rate,
    }));

    // 3. Create Estimate
    console.log(`[Assistant Tool: create_zoho_quote] Creating estimate in Zoho Books...`);
    const estimate = await ZohoBooksService.createEstimate(contactId, lineItems);
    console.log(`[Assistant Tool: create_zoho_quote] Estimate created: ${estimate.estimate_number} (ID: ${estimate.estimate_id})`);

    const formattedTotal = estimate.total !== undefined ? `$${estimate.total.toFixed(2)}` : "No total available";
    const reply = `✅ **Quotation Created (Draft) Successfully!**\n\n` +
      `- **Estimate Number:** ${estimate.estimate_number}\n` +
      `- **Customer Name:** ${estimate.customer_name}\n` +
      `- **Customer Email:** ${customerEmail}\n` +
      `- **Total Amount:** ${formattedTotal}\n\n` +
      `The quotation has been saved as a **draft** in Zoho Books (no email was sent to the customer).`;

    const speakReply = `I successfully created draft quote number ${estimate.estimate_number} for ${estimate.customer_name} totaling ${formattedTotal}.`;

    return NextResponse.json({
      reply,
      speakReply,
      estimate,
    });
  } catch (error) {
    console.error("[Assistant Tool: create_zoho_quote] failed:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      reply: `⚠️ **Failed to create quotation in Zoho Books**: ${errMsg}`,
      speakReply: "I encountered an error trying to create the quotation in Zoho Books.",
      error: errMsg,
    });
  }
}
