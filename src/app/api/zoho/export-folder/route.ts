import { NextRequest } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";

export const dynamic = "force-dynamic";

/** Safety cap so a huge folder can't run away. */
const MAX_EMAILS = 500;
const CONCURRENCY = 5;

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * GET /api/zoho/export-folder?accountId=&folderId=
 *
 * Exports every email in a folder (subject/sender/date + full body text) as a
 * single plain-text file — for feeding real examples to the LLM. Paginates the
 * whole folder and fetches bodies with limited concurrency.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const folderId = searchParams.get("folderId");
  if (!folderId) {
    return new Response(JSON.stringify({ error: "folderId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Page through the whole folder (list only — cheap).
    const all: Awaited<ReturnType<typeof ZohoService.getEmails>> = [];
    let start = 1;
    while (all.length < MAX_EMAILS) {
      const page = await ZohoService.getEmails({
        accountId,
        folderId,
        start,
        limit: 200,
      });
      if (page.length === 0) break;
      all.push(...page);
      if (page.length < 200) break;
      start += 200;
    }

    // 2) Fetch each body with a small concurrency cap.
    const bodies = new Array<string>(all.length).fill("");
    let cursor = 0;
    const worker = async () => {
      while (cursor < all.length) {
        const i = cursor++;
        const e = all[i];
        try {
          const html = await ZohoService.getEmailContent(
            e.messageId,
            e.folderId,
            accountId
          );
          bodies[i] = htmlToText(html);
        } catch {
          bodies[i] = e.summary ?? "";
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, all.length) }, worker)
    );

    // 3) Format one big text file.
    const text = all
      .map((e, i) => {
        const date =
          e.receivedAt instanceof Date ? e.receivedAt.toISOString() : "";
        return (
          `===== EMAIL ${i + 1} of ${all.length} =====\n` +
          `From: ${e.senderName} <${e.from}>\n` +
          `To: ${e.to}\n` +
          `Subject: ${e.subject}\n` +
          `Date: ${date}\n\n` +
          bodies[i]
        );
      })
      .join("\n\n\n");

    return new Response(text || "(folder is empty)", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
