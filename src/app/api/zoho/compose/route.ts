import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import { replyTextToHtml } from "../../../../lib/reply/llm-orchestrator";

export const dynamic = "force-dynamic";

/**
 * POST /api/zoho/compose — send (or save as draft) a BRAND-NEW email to any
 * recipient, contact or not. Body: { to, cc?, subject?, content, action? }.
 *   action "send"  (default) → sends immediately
 *   action "draft"           → saves to Zoho Drafts
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: {
    to?: string;
    cc?: string;
    subject?: string;
    content?: string;
    action?: "send" | "draft";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { error: "A valid recipient email is required" },
      { status: 400 }
    );
  }

  const cc = (body.cc ?? "").trim();
  const subject = (body.subject ?? "").trim() || "(no subject)";
  const action = body.action === "draft" ? "draft" : "send";
  // RichEditor already produces HTML; plain text is escaped by replyTextToHtml.
  const content = replyTextToHtml(body.content ?? "");

  try {
    const params = {
      toAddress: to,
      subject,
      content,
      ccAddress: cc || undefined,
    };
    if (action === "draft") {
      await ZohoService.saveDraft(params);
    } else {
      await ZohoService.sendEmail(params);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/zoho/compose] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
