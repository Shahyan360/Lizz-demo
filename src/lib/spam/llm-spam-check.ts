import { z } from "zod";
import { getGeminiModel, geminiChatWithRetry } from "../../config/gemini";

/**
 * LLM content-based spam / scam / phishing detector.
 *
 * The deterministic classifier only reads envelope signals (List-Unsubscribe,
 * Precedence, bulk mailers, sender patterns). It cannot catch a scam that was
 * hand-typed from an ordinary personal address (e.g. a "you won a gift card"
 * message). This reads the actual CONTENT and decides whether the business
 * should refuse to engage. It runs only after the deterministic pass says the
 * mail looks personal — so it's a second opinion on otherwise-clean mail.
 *
 * Fails OPEN: on any error it returns `isSpam: false`, so a transient LLM
 * failure never silently drops a genuine customer email.
 */

const outputSchema = z.object({
  isSpam: z.boolean(),
  reason: z.string().optional(),
});

/** Truncated to keep the request within the free-tier token budget. */
const MAX_BODY_CHARS = 2000;

/**
 * Real customer AP / CRM / tax-paperwork threads are often misclassified as
 * phishing because they mention W-9s, invoices, and account numbers.
 * Treat those as legitimate unless hard phishing cues are also present.
 */
export function isLikelyCustomerAdminOrBillingEmail(
  subject: string,
  bodyText: string
): boolean {
  const text = `${subject}\n${bodyText}`.toLowerCase();

  const phishingHard = [
    /\bverify (your|the) (password|login|credentials|account)\b/,
    /\bclick (here|below|the link) to (confirm|verify|secure|unlock)\b/,
    /\b(wire transfer|gift\s*cards?|bitcoin|crypto(?:currency)?)\b/,
    /\burgent.{0,60}(suspend|locked|compromised|unauthorized)\b/,
    /\bconfirm (your|the) (ssn|social security|bank routing|routing number)\b/,
    /\bpay (us|immediately) via\b/,
  ];
  if (phishingHard.some((re) => re.test(text))) return false;

  const adminSignals = [
    /\bcrm\b|\bcustomer file\b|\baccount records?\b|\baccount\s*#?\s*\d+/,
    /\bvendor records?\b|\bcorporate account\b|\bupdate.*(?:billing|account|records)\b/,
    /\bbilling address\b|\baccounts payable\b|\bap contact\b|\binvoices@/,
    /\bw-9\b|\btax exempt\b|\bst-?12\b|\bexemption form\b|\btax files?\b/,
    /\bprimary ap contact\b|\bbilling supervisor\b|\baccounting phone\b/,
  ];
  const hits = adminSignals.reduce(
    (count, re) => count + (re.test(text) ? 1 : 0),
    0
  );
  return hits >= 2;
}

export function isLikelyCustomerReply(subject: string, bodyText: string): boolean {
  const cleanSubject = subject.trim().toLowerCase();
  if (
    cleanSubject.startsWith("re:") ||
    cleanSubject.startsWith("fwd:") ||
    cleanSubject.startsWith("aw:") ||
    cleanSubject.startsWith("fw:")
  ) {
    return true;
  }
  const text = bodyText.toLowerCase();
  const replyIndicators = [
    /\byour team requested\b/,
    /\bas requested\b/,
    /\bhere is the photo\b/,
    /\bhere are the photos\b/,
    /\bhere is the file\b/,
    /\bhere are the files\b/,
    /\brequested photos?\b/,
    /\bsent the photos?\b/
  ];
  return replyIndicators.some((re) => re.test(text));
}

export async function llmSpamCheck(input: {
  from: string;
  subject: string;
  bodyText: string;
}): Promise<{ isSpam: boolean; reason: string }> {
  const body = input.bodyText.slice(0, MAX_BODY_CHARS);

  // Safety net: bypass/override if it's a thread reply or explicitly mentions a request
  if (isLikelyCustomerReply(input.subject, body)) {
    return {
      isSpam: false,
      reason: "Bypassed LLM check — detected as user reply or requested follow-up",
    };
  }

  // Safety net before the LLM: keep real vendor/CRM/billing paperwork in inbox.
  if (isLikelyCustomerAdminOrBillingEmail(input.subject, body)) {
    return {
      isSpam: false,
      reason: "Customer CRM/billing/admin paperwork — keep in inbox",
    };
  }

  const system =
    "You are a spam/scam/phishing detector for a business inbox (AutoGate " +
    "Electric, an automatic-gate / access-control company). Decide whether " +
    "this email is unsolicited junk the business should NOT reply to.\n\n" +
    "Mark isSpam=true ONLY for clear junk: prize/lottery/gift-card cons, " +
    "credential phishing (fake login/password links), crypto/investment bait, " +
    "adult content, unsolicited mass marketing or cold sales pitches, obvious " +
    "bulk blasts, and fake payment demands that pressure for immediate wire/" +
    "gift-card payment.\n\n" +
    "Mark isSpam=false for real customer or vendor business mail, including:\n" +
    "- sales inquiries, quote requests, support/service, complaints, scheduling\n" +
    "- invoice/billing questions and accounts-payable correspondence\n" +
    "- CRM / customer-file / account-record updates (new billing address, AP " +
    "contact, account number, company merge/rename)\n" +
    "- requests to exchange normal tax paperwork (W-9, ST-12, tax-exemption " +
    "forms) between established vendors and customers\n" +
    "- normal professional correspondence with a named person and company\n" +
    "- ANY customer replies, follow-ups, or responses sending photos/files/information " +
    "previously requested by the team (e.g., phrases like 'your team requested', 'here is the photo', 'as requested')\n\n" +
    "CRITICAL OVERRIDES — NEVER mark these as spam:\n" +
    "1. ACTIVE THREAD OVERRIDE: If the email subject starts with 'Re:' or 'Fwd:', " +
    "or if the body contains quoted text suggesting a prior exchange with AutoGate, " +
    "it is part of an active thread. Any active AutoGate staff member may " +
    "have participated. NEVER flag active threads as spam.\n" +
    "2. VENDOR / INFRASTRUCTURE COORDINATION: If AutoGate appears to be CC'd on an " +
    "email between a customer and a third-party vendor (ISP, electrician, utility " +
    "company), treat it as legitimate infrastructure coordination — not spam.\n" +
    "3. ONLY flag a cold inbound email as misdirected or out-of-scope if it is " +
    "brand new, from a fully unknown sender with no prior thread history, AND has " +
    "zero connection to gates, access control, security, or site infrastructure.\n\n" +
    "IMPORTANT: Mentions of W-9, invoices, billing addresses, account numbers, " +
    "or tax forms alone are NOT phishing. Those are routine for a gate/" +
    "access-control vendor. Only flag tax/billing content as spam when it also " +
    "shows clear scam tactics (urgency + credential links, wire/gift-card " +
    "payment, impersonation of AutoGate IT/banks, etc.). Also, never flag " +
    "responses or follow-ups to prior conversations/requests as spam, even if sent " +
    "from generic personal email addresses (like outlook.com, gmail.com, etc.).\n" +
    "When genuinely unsure, choose false (keep in inbox).\n" +
    'Respond ONLY as JSON: {"isSpam": <true|false>, "reason": "<short reason>"}.';

  const user = `FROM: ${input.from}\nSUBJECT: ${input.subject}\n\nBODY:\n${body}`;

  try {
    const response = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 150,
    });

    const parsed = outputSchema.parse(
      JSON.parse(response.choices[0].message.content || "{}")
    );

    // Second safety net if the model still over-flags admin paperwork.
    if (
      parsed.isSpam &&
      isLikelyCustomerAdminOrBillingEmail(input.subject, body)
    ) {
      return {
        isSpam: false,
        reason: "Overrode AI spam flag — customer CRM/billing/admin paperwork",
      };
    }

    return { isSpam: parsed.isSpam, reason: parsed.reason ?? "" };
  } catch (err) {
    console.warn("[llm-spam-check] failed; treating as not spam:", err);
    return { isSpam: false, reason: "" };
  }
}
