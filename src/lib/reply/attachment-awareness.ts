/**
 * When an inbound email already has real (non-inline) attachments, Lizzz must
 * not ask the customer to send photos/files again — even if the body text never
 * mentions them.
 *
 * Opposite case: the customer claims they attached files, but Zoho shows none.
 * Lizzz must politely ask them to re-attach (do not treat the claim as proof).
 */

const PHOTO_ASK_LINE =
  /^\s*[-•*]?\s*(?:\d+(?:\s+or\s+\d+)?\s+)?(?:overview\s+)?(?:a\s+few\s+)?(?:photo|photos|picture|pictures|image|images|diagram)\b.*$/gim;

const PHOTO_ASK_SENTENCE =
  /[^.!?\n]*\b(?:please\s+)?(?:also\s+)?(?:send|attach|provide|include|upload|share)\b[^.!?\n]*\b(?:photo|photos|picture|pictures|image|images|diagram|attachment|attachments)\b[^.!?\n]*[.!?]?\s*/gi;

/** Body text that claims files were attached (even if none actually arrived). */
const CLAIMS_ATTACHMENT_RE =
  /\b(?:i(?:'ve| have)?|we(?:'ve| have)?|attached|attaching|enclosed|enclosing)\b[\s\S]{0,80}\b(?:attach(?:ed|ing)?|photo|photos|picture|pictures|image|images|file|files|pdf|document|documents)\b|\b(?:photo|photos|picture|pictures|image|images|file|files)\b[\s\S]{0,40}\b(?:attached|enclosed|below|herewith)\b|\bplease (?:find|see) (?:the )?(?:attached|enclosed)\b/i;

/** True when Zoho listed one or more real attachments on the inbound message. */
export function hasInboundAttachments(names: string[] | null | undefined): boolean {
  return (names ?? []).some((n) => n.trim().length > 0);
}

/** True when the customer’s wording claims they sent an attachment/photo. */
export function claimsAttachmentsInText(body: string | null | undefined): boolean {
  return CLAIMS_ATTACHMENT_RE.test(body ?? "");
}

/**
 * Customer said they attached something, but the email has no real attachments.
 * Trust the mailbox listing over the claim.
 */
export function claimedAttachmentsMissing(
  body: string | null | undefined,
  attachmentNames: string[] | null | undefined
): boolean {
  return claimsAttachmentsInText(body) && !hasInboundAttachments(attachmentNames);
}

/** Marks Photos Provided and removes photo asks from Missing Information. */
export function markPhotosProvidedFromAttachments(
  details: Record<string, string | undefined>,
  attachmentNames: string[]
): Record<string, string | undefined> {
  if (!hasInboundAttachments(attachmentNames)) return details;

  const next: Record<string, string | undefined> = { ...details };
  const listed = attachmentNames.map((n) => n.trim()).filter(Boolean);
  const existing = (next["Photos Provided?"] ?? "").trim();
  if (!/^yes\b/i.test(existing)) {
    next["Photos Provided?"] = listed.length
      ? `Yes (${listed.slice(0, 5).join(", ")})`
      : "Yes";
  }

  const missing = (next["Missing Information"] ?? "").trim();
  if (missing && missing.toLowerCase() !== "none") {
    const cleaned = missing
      .split(/,\s*/)
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/\b(photo|photos|picture|pictures|image|images|diagram|attachment|attachments)\b/i.test(p));
    next["Missing Information"] = cleaned.length ? cleaned.join(", ") : "None";
  }

  return next;
}

/**
 * When the customer claimed attachments but none arrived, keep Photos Provided
 * honest and ensure photos stay in Missing Information.
 */
export function markMissingClaimedAttachments(
  details: Record<string, string | undefined>,
  body: string,
  attachmentNames: string[]
): Record<string, string | undefined> {
  if (!claimedAttachmentsMissing(body, attachmentNames)) return details;

  const next: Record<string, string | undefined> = { ...details };
  next["Photos Provided?"] = "No — customer said attached, but no file arrived";

  const missing = (next["Missing Information"] ?? "").trim();
  if (!missing || missing.toLowerCase() === "none") {
    next["Missing Information"] = "Photos / attachments (claimed but not received)";
  } else if (!/\b(photo|photos|picture|attachment|file)\b/i.test(missing)) {
    next["Missing Information"] = `${missing}, Photos / attachments (claimed but not received)`;
  }
  return next;
}

/**
 * Rewrites a customer-facing draft so it does not ask for attachments that
 * were already on the inbound email. Keeps other intake questions (address,
 * goals, etc.).
 */
export function stripPhotoAsksFromDraft(
  draft: string,
  attachmentNames: string[]
): string {
  if (!hasInboundAttachments(attachmentNames) || !draft.trim()) return draft;

  let text = draft;
  text = text.replace(PHOTO_ASK_LINE, "");
  text = text.replace(PHOTO_ASK_SENTENCE, "");
  text = text.replace(
    /^\s*If you can, please also send over:\s*$/gim,
    "If you can, please also share:"
  );
  text = text.replace(/info and photos/gi, "info");
  text = text.replace(/photos? and (?:info|details)/gi, "details");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // Do NOT prepend an explicit acknowledgment line — the LLM has already seen
  // the attachment content and should incorporate it naturally into the reply.

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

const MISSING_ATTACH_NUDGE =
  "I saw you mentioned an attachment, but I don’t see any file on this email — could you please re-attach the photo(s) or file(s) and send them again?";

/**
 * If the body claims an attachment but none arrived, make sure the reply asks
 * the customer to re-send it (without pretending we already have the file).
 */
export function ensureMissingAttachmentAskInDraft(
  draft: string,
  body: string,
  attachmentNames: string[]
): string {
  if (!claimedAttachmentsMissing(body, attachmentNames) || !draft.trim()) {
    return draft;
  }

  let text = draft;
  text = text.replace(
    /^[^\n]*\b(?:received|got|see|saw)\b[^\n]*\b(?:attachment|attachments|photo|photos|file|files)\b[^\n]*\n+/gim,
    ""
  );

  const alreadyAsking =
    /\b(?:don'?t see|did not (?:receive|get|see)|no (?:file|attachment|photo)|re-?attach|attach(?:ed)? again|send .{0,20}again)\b/i.test(
      text
    );
  if (!alreadyAsking) {
    if (/^Hi[^\n]*[,!]?\s*\n/i.test(text)) {
      text = text.replace(/^(Hi[^\n]*[,!]?\s*\n)/i, `$1${MISSING_ATTACH_NUDGE}\n\n`);
    } else {
      text = `${MISSING_ATTACH_NUDGE}\n\n${text}`;
    }
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Builds the attachmentNote field injected into the LLM JSON payload. */
export function buildAttachmentNote(
  body: string,
  attachmentNames: string[]
): string {
  if (hasInboundAttachments(attachmentNames)) {
    const pdfNames = attachmentNames.filter((n) => /\.pdf$/i.test(n));
    const hasPdfs = pdfNames.length > 0;
    const isQuotePdf = pdfNames.some((n) => /^Q-?\d+/i.test(n));

    // Tell the LLM the files exist and are already in context — do NOT instruct
    // it to name or explicitly acknowledge the files in the customer reply.
    let note =
      `The customer has attached ${attachmentNames.length} file(s) to this email. ` +
      `These files have been provided to you as context — use them to understand ` +
      `the customer's situation and write a more informed reply. ` +
      `Do NOT ask the customer to send photos, pictures, images, or attachments again. ` +
      `Do NOT list or name the files in your reply. ` +
      `Set Photos Provided? to Yes.`;

    if (hasPdfs) {
      note +=
        ` The email includes PDF document(s). You cannot read PDFs directly, but they ` +
        `likely contain project details, addresses, or pricing. Do NOT ask the customer ` +
        `for information that is probably already inside these documents. ` +
        `Focus on what the customer actually requested in their message.`;
    }

    if (isQuotePdf) {
      note +=
        ` These appear to be AutoGate quote documents — treat this as a follow-up ` +
        `from an existing customer, not a new intake.`;
    }

    return note;
  }
  if (claimedAttachmentsMissing(body, attachmentNames)) {
    return (
      "The customer SAID they attached a photo/file, but attachmentsPresent is false " +
      "and the attachments array is empty — no file actually arrived. Do NOT say you " +
      "received the attachment. Politely tell them you do not see a file on this email " +
      "and ask them to re-attach and resend. Set Photos Provided? to No and keep photos " +
      "in Missing Information."
    );
  }
  return "No files were attached to this email.";
}
