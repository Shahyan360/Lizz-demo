// Ordered list of fields that appear in the Evernote note template.
// These are generic enough to cover all service types (gates, video surveillance,
// access control, etc.). The LLM fills in "N/A" for fields that don't apply.
export const EVERNOTE_FIELD_NAMES = [
  "Customer / Property",
  "Contact Info",
  "Site Address",
  "Request Type",
  "Existing Gate?",
  "Existing Equipment Mentioned",
  "Photos Provided?",
  "Power at Gate?",
  "Phone/Network at Gate?",
  "UL325 Acceptance Mentioned?",
  "Customer Goals",
  "Relevant History Found",
  "Missing Information",
  "Additional Information",
  "Summary of Request",
];

/** Fields for scheduling handoffs to Evernote (site visits, sales meetings, etc.). */
export const SCHEDULING_FIELD_NAMES = [
  "Customer / Property",
  "Contact Info",
  "Site Address",
  "Meeting Type",
  "Purpose / Context",
  "Preferred Dates / Times",
  "Alternate Availability",
  "Missing Information",
  "Summary of Request",
];

function normalizeMissingInformation(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
}

/** True only when intake is complete — Evernote must not fire before this. */
export function isEvernoteHandoffComplete(
  details: Record<string, string | undefined> | null | undefined
): boolean {
  if (!details) return false;
  return normalizeMissingInformation(details["Missing Information"]) === "none";
}

export function hasMinimalProposalIdentity(
  details: Record<string, string | undefined>
): boolean {
  return (
    (details["Customer / Property"] ?? "").trim().length > 0 &&
    (details["Contact Info"] ?? "").trim().length > 0
  );
}

const NEW_INSTALL_TEXT_RE =
  /\b(new\s+(gate\s+)?install(ation)?|brand[- ]?new\s+(gate|install)|install\s+a\s+new\s+gate)\b/i;

/** Brand-new residential gate install (no existing gate) — decline after intake, Normal priority. */
export function isBrandNewResidentialGateInstall(
  details: Record<string, string | undefined>
): boolean {
  const requestType = (details["Request Type"] ?? "").trim();
  const existingGate = (details["Existing Gate?"] ?? "").trim().toLowerCase();

  if (existingGate === "yes") return false;
  if (NEW_INSTALL_TEXT_RE.test(requestType)) return true;
  if (existingGate === "no" && /install/i.test(requestType)) return true;

  return false;
}

/** Enforces router-system.ts priority rules (Medium → Normal in tool schema). */
export function resolveProposalPriority(
  details: Record<string, string | undefined>
): "High" | "Normal" | "Low" {
  if (isBrandNewResidentialGateInstall(details)) return "Normal";

  const requestType = (details["Request Type"] ?? "").toLowerCase();
  if (/(replacement|upgrade|modernization)/i.test(requestType)) return "High";
  if (/commercial|hoa|video surveillance|access control|intercom/i.test(requestType)) {
    return "High";
  }

  return "Normal";
}

export function wasDeclineAlreadySent(contactHistory: string): boolean {
  return /aren't taking on/i.test(contactHistory);
}

/** Intake template sent and thread is a brand-new install ready for decline handoff. */
export function isNewInstallReadyForDecline(
  llmPayload: string,
  contactHistory: string
): boolean {
  if (wasDeclineAlreadySent(contactHistory)) return false;

  let body = "";
  try {
    body = String(JSON.parse(llmPayload).threadDetails?.body ?? "");
  } catch {
    return false;
  }

  const combined = `${contactHistory}\n${body}`;
  const mentionsNewInstall =
    NEW_INSTALL_TEXT_RE.test(combined) ||
    /existing gate\?:\s*no/i.test(combined) ||
    /request type:.*new gate/i.test(combined);

  if (!mentionsNewInstall) return false;

  return /residential gate and call box proposal request/i.test(combined);
}

/**
 * Lizzz already acknowledged that details were received and handed off.
 * IMPORTANT: do NOT match the proposal template's future language
 * ("we'll follow up with a ballpark estimate") — that blocked first-time
 * Proposal Review handoffs after intake.
 */
const POST_HANDOFF_ACK_PATTERNS: RegExp[] = [
  /\bgot your details\b/i,
  /\bwe(?:'ve| have) (?:got|received) (?:your|the) (?:details|information)\b/i,
  /\beverything we need\b/i,
  /\bdetails (?:have been )?(?:forwarded|sent) to (?:the )?team\b/i,
  /\b(?:jeff|dave)\s+will\s+(?:follow up|review|reach out|get back|confirm|prepare|provide)\b/i,
  /\bthanks[,.]?\s+(?:\w+\s+){0,6}(?:details|information).{0,80}(?:jeff|dave|team)\s+will\b/is,
];

function hasPostHandoffAcknowledgment(contactHistory: string): boolean {
  return POST_HANDOFF_ACK_PATTERNS.some((pattern) =>
    pattern.test(contactHistory)
  );
}

/** True when proposal intake was already forwarded — do not send Evernote again. */
export function wasProposalHandoffAlreadySent(contactHistory: string): boolean {
  if (!contactHistory.trim()) return false;
  // Require a real post-handoff acknowledgment — not the intake template alone.
  return hasPostHandoffAcknowledgment(contactHistory);
}

/** True when scheduling details were already forwarded to Evernote. */
export function wasSchedulingHandoffAlreadySent(contactHistory: string): boolean {
  if (!contactHistory.trim()) return false;
  if (!/scheduling request/i.test(contactHistory)) return false;
  return (
    hasPostHandoffAcknowledgment(contactHistory) ||
    /\bsarah will (?:follow up|confirm|schedule|reach out)\b/i.test(
      contactHistory
    )
  );
}

/** True when admin/CRM details were already forwarded to Evernote. */
export function wasAdminHandoffAlreadySent(contactHistory: string): boolean {
  if (!contactHistory.trim()) return false;
  if (!/admin follow up/i.test(contactHistory)) return false;
  return (
    hasPostHandoffAcknowledgment(contactHistory) ||
    /\bbeverly will (?:follow up|review|reach out)\b/i.test(contactHistory)
  );
}

/** Fields for CRM / admin handoffs to Beverly via Evernote. */
export const ADMIN_FIELD_NAMES = [
  "Customer / Property",
  "Contact Info",
  "Request Type",
  "Details / Issue",
  "Related Account or Project",
  "Urgency",
  "Relevant History Found",
  "Missing Information",
  "Summary of Request",
];
