/**
 * Business categories for inbound mail classification. Kept free of any
 * server-only imports so both the LLM classifier (server) and the email list
 * (client) can share these definitions.
 */

export const BUSINESS_CATEGORIES = [
  "sales_inquiry",
  "quote_request",
  "invoice_question",
  "complaint",
  "support",
  "other",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

/** Human-readable label per category. */
export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  sales_inquiry: "New Sales Inquiry",
  quote_request: "Quote Request",
  invoice_question: "Invoice Question",
  complaint: "Complaint",
  support: "Support Request",
  other: "Other",
};

/** A short description of each category — also fed to the LLM as its rubric. */
export const CATEGORY_DESCRIPTIONS: Record<BusinessCategory, string> = {
  sales_inquiry:
    "A NEW prospect/customer asking about products or services, availability, or wanting to start a project or buy something.",
  quote_request:
    "Asking for pricing, an estimate, a proposal, or a formal quote for specific work or products.",
  invoice_question:
    "STRICTLY about money: an invoice, a bill, a payment, a refund, a billing statement, or accounts receivable/payable. Use ONLY when the email is about money owed or paid — NOT about account setup, activation, or access.",
  complaint:
    "Dissatisfaction, a problem with work done, something broken, or an escalation.",
  support:
    "A request for help, service, or troubleshooting; account setup / activation / access issues (e.g. 'our account is not active', 'get us set up in your system'); scheduling service; or a technical follow-up.",
  other:
    "General correspondence, replies, out-of-office/auto-replies, internal notes, or anything that does not clearly fit the categories above.",
};

/** Badge colors (CSS values) per category for the UI. */
export const CATEGORY_COLORS: Record<
  BusinessCategory,
  { bg: string; fg: string }
> = {
  sales_inquiry: { bg: "rgba(16, 185, 129, 0.15)", fg: "#10B981" },
  quote_request: { bg: "rgba(99, 102, 241, 0.15)", fg: "#818CF8" },
  invoice_question: { bg: "rgba(245, 158, 11, 0.15)", fg: "#F59E0B" },
  complaint: { bg: "rgba(239, 68, 68, 0.15)", fg: "#F87171" },
  support: { bg: "rgba(59, 130, 246, 0.15)", fg: "#60A5FA" },
  other: { bg: "rgba(156, 163, 175, 0.15)", fg: "#9CA3AF" },
};

/** The classification the AI returns for an email. */
export interface EmailClassification {
  category: BusinessCategory;
  label: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
}

/** Narrows an arbitrary string to a known category, defaulting to "other". */
export function toBusinessCategory(value: unknown): BusinessCategory {
  return BUSINESS_CATEGORIES.includes(value as BusinessCategory)
    ? (value as BusinessCategory)
    : "other";
}
