import { ZohoService } from "../../services/zoho.service";

/**
 * Prepares an inbound email's attachments for the reply generator: every
 * attachment's name (so the model can acknowledge it) and, for images, the
 * bytes as a base64 data URI so Gemini's vision can actually READ them
 * (e.g. a customer's photo of a broken gate).
 *
 * Entirely best-effort — any fetch/download failure is swallowed so an
 * attachment problem never blocks the reply.
 */

export interface ReplyAttachment {
  name: string;
  isImage: boolean;
  /** Set only for images that were downloaded — `data:<mime>;base64,<...>`. */
  dataUri?: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
/** Cap per image so a huge file can't blow the token budget / latency. */
const MAX_IMAGE_BYTES = 4_000_000;
/** Only read the first few images — enough context, bounded cost. */
const MAX_IMAGES = 3;

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

export async function fetchReplyAttachments(params: {
  messageId: string;
  folderId: string;
  accountId?: string;
}): Promise<ReplyAttachment[]> {
  const { messageId, folderId, accountId } = params;

  let items;
  try {
    items = await ZohoService.getEmailAttachments(messageId, folderId, accountId);
  } catch (err) {
    console.warn("[attachments] list failed:", err);
    return [];
  }

  // Real (non-inline) attachments — these can be downloaded for Gemini vision.
  const real = items.filter((a) => !a.isInline);
  // Inline images are embedded in the HTML body (e.g. <img src="cid:...">).
  // They cannot be downloaded the same way, but they ARE visual content the
  // customer sent — include them by name so Lizzz never asks for a re-send.
  const inlineImages = items.filter(
    (a) => a.isInline && IMAGE_EXT.test(a.attachmentName || "")
  );

  const out: ReplyAttachment[] = [];
  let imagesRead = 0;

  for (const a of real) {
    const name = a.attachmentName || "attachment";
    const isImage = IMAGE_EXT.test(name);

    if (isImage && imagesRead < MAX_IMAGES) {
      try {
        const res = await ZohoService.getAttachmentResponse(
          messageId,
          folderId,
          a.attachmentId,
          accountId
        );
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0 && buf.length <= MAX_IMAGE_BYTES) {
          const mime = mimeFromName(name);
          out.push({
            name,
            isImage: true,
            dataUri: `data:${mime};base64,${buf.toString("base64")}`,
          });
          imagesRead += 1;
          continue;
        }
      } catch (err) {
        console.warn(`[attachments] download failed for "${name}":`, err);
      }
    }

    // Non-image, oversized, or failed download → at least surface the name.
    out.push({ name, isImage });
  }

  // Add inline images as name-only entries (no download, just awareness).
  for (const a of inlineImages) {
    const name = a.attachmentName || "inline-image";
    out.push({ name, isImage: true });
  }

  return out;
}

