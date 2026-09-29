import type { CleanedEmailMetadata } from "../parsingAgent";
import type { WritingDirectives } from "../mimicAgent";
import type {
  ColdStartSignals,
  DirectHistorySignals,
  RelatedHistorySignals,
  SentCorpusSignals,
} from "../../lib/schemas/conversation-context";
import type { StyleFingerprint } from "../../lib/schemas/style-fingerprint";

/**
 * Tier-aware Reasoning Agent prompt builders. Five pure functions, one per
 * conversation tier, each returning a `{ system, user }` pair. Prompt text
 * lives here; the agent only dispatches and executes.
 */

export interface ReasoningPrompt {
  system: string;
  user: string;
}

/** Inputs common to every tier. */
export interface PromptBase {
  parsedEmail: CleanedEmailMetadata;
  directives: WritingDirectives;
}

const OUTPUT_CONTRACT = `Your final output MUST be a single valid JSON object:
{
  "inferredIntent": "scheduling_request | business_pitch | support | escalation | other",
  "urgencyScore": 0.4,
  "draftText": "The final plain-text email reply draft",
  "reasoningLog": "Bullet points explaining the strategic decisions and constraints satisfied",
  "confidence": 0.92,
  "isSafe": true,
  "violations": [],
  "redactedText": "Include this field ONLY when you masked something; omit it entirely when isSafe is true"
}`;

function systemPrompt(styleGuidance: string): string {
  return `You are a Personalized Executive AI agent. For the incoming email below you will, in ONE response, classify it, draft a reply in the user's authentic voice, and self-audit that draft.

STYLE STRATEGY FOR THIS EMAIL:
${styleGuidance}

Protocol:
1. CLASSIFY — infer the email's intent and an urgency score (0.0 = routine, 1.0 = critical).
2. DRAFT — identify the points the reply must address, decide the answer strategy (Approve, Deny, Delay, Schedule, or Request Detail), and write the draft. Match the user's greeting, sign-off, sentence length, and vocabulary as evidenced below. Never use a forbidden word.
3. SELF-AUDIT — check the draft for leaked secrets / credentials / PII, severe factual hallucination, and toxic or wildly out-of-character tone. If anything is unsafe, set "isSafe" to false, list "violations", and provide "redactedText" with secrets masked.
4. Rate "confidence" (0.0-1.0) that the draft reflects the user's authentic voice and is safe to send.

${OUTPUT_CONTRACT}`;
}

function renderIncomingEmail(email: CleanedEmailMetadata): string {
  const body =
    email.cleanedText.length > 4000
      ? `${email.cleanedText.slice(0, 4000)}\n[...truncated]`
      : email.cleanedText;
  return [
    "### INCOMING EMAIL",
    `From: ${email.senderName} <${email.senderEmail}>`,
    "Body:",
    body,
  ].join("\n");
}

function renderDirectives(directives: WritingDirectives): string {
  return [
    "### USER WRITING PROFILE (baseline floor)",
    ...directives.directives.map((line) => `- ${line}`),
    `- Greeting template: "${directives.greetingStyle}"`,
    `- Sign-off template: "${directives.signoffStyle}"`,
    `- FORBIDDEN WORDS (never use any of these): [${directives.forbiddenList.join(", ")}]`,
  ].join("\n");
}

function renderFingerprint(fingerprint: StyleFingerprint): string {
  const lines = [
    `- Average sentence length: ${fingerprint.avgSentenceLength.toFixed(1)} words`,
    `- Average message length: ${fingerprint.avgMessageLength.toFixed(1)} words`,
    `- Contraction usage: ${(fingerprint.contractionRate * 100).toFixed(0)}%`,
    `- Questions: ${(fingerprint.questionRate * 100).toFixed(0)}% of sentences`,
    `- Exclamations: ${(fingerprint.exclamationRate * 100).toFixed(0)}% of sentences`,
  ];
  if (fingerprint.greetingPatterns.length > 0) {
    lines.push(`- Typical greetings: ${fingerprint.greetingPatterns.join(" | ")}`);
  }
  if (fingerprint.signoffPatterns.length > 0) {
    lines.push(`- Typical sign-offs: ${fingerprint.signoffPatterns.join(" | ")}`);
  }
  if (fingerprint.frequentBigrams.length > 0) {
    lines.push(`- Characteristic phrases: ${fingerprint.frequentBigrams.join(", ")}`);
  }
  if (fingerprint.sampleSnippets.length > 0) {
    lines.push("- Example sentences in the user's voice:");
    for (const snippet of fingerprint.sampleSnippets) {
      lines.push(`  • "${snippet}"`);
    }
  }
  return lines.join("\n");
}

const USER_INSTRUCTION =
  "### TASK\nDraft the reply now. Treat the writing profile as a baseline and the tier-specific style evidence as the priority signal. Return only the JSON object.";

function compose(
  base: PromptBase,
  styleGuidance: string,
  contextSection: string
): ReasoningPrompt {
  return {
    system: systemPrompt(styleGuidance),
    user: [
      renderIncomingEmail(base.parsedEmail),
      contextSection,
      renderDirectives(base.directives),
      USER_INSTRUCTION,
    ].join("\n\n"),
  };
}

/** Tier 1 — prior correspondence with this exact recipient. */
export function buildDirectHistoryPrompt(
  base: PromptBase,
  signals: DirectHistorySignals
): ReasoningPrompt {
  const guidance =
    "You have prior correspondence with this EXACT recipient. Match the cadence, greeting style, and vocabulary patterns demonstrated below. This is the authoritative voice for this specific relationship.";
  const section = [
    "### CONVERSATION CONTEXT - DIRECT HISTORY (Tier 1)",
    `Prior replies the user sent this contact: ${signals.userSentMessageCount}.`,
    `Relationship closeness: ${signals.relationshipScore.toFixed(2)} (0 = cold, 1 = close).`,
    `Formality level: ${signals.formalityLevel.toFixed(2)} (0 = casual, 1 = formal).`,
    `Interaction count: ${signals.interactionCount}.`,
    `Notes on contact: ${signals.notes || "none"}.`,
    signals.recentSummaries.length > 0
      ? `Recent thread history:\n${signals.recentSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "Recent thread history: none recorded.",
    "",
    "How the user has written to THIS person:",
    renderFingerprint(signals.fingerprint),
  ].join("\n");
  return compose(base, guidance, section);
}

/** Tier 2 — tonally related past conversations (no recipient PII). */
export function buildRelatedHistoryPrompt(
  base: PromptBase,
  signals: RelatedHistorySignals
): ReasoningPrompt {
  const guidance =
    "No direct history with this recipient, but tonally related past conversations exist. Mimic the tone of those past exchanges. Do NOT assume personal familiarity with the recipient.";
  const section = [
    "### CONVERSATION CONTEXT - RELATED HISTORY (Tier 2)",
    `Found ${signals.matchCount} tonally related past repl${signals.matchCount === 1 ? "y" : "ies"} (top similarity ${signals.topScore.toFixed(2)}).`,
    "Recipient-specific details are withheld by design — mimic tone only.",
    "",
    "Tone profile of those related replies:",
    renderFingerprint(signals.fingerprint),
  ].join("\n");
  return compose(base, guidance, section);
}

/** Tier 3a — recent Gmail "Sent" mail addressed to this exact recipient. */
export function buildSentCorpusToSenderPrompt(
  base: PromptBase,
  signals: SentCorpusSignals
): ReasoningPrompt {
  const guidance =
    "You have recent sent mail to this EXACT recipient, pulled from the user's Gmail Sent folder. Treat these as the authoritative voice for this relationship.";
  const section = [
    "### CONVERSATION CONTEXT - SENT MAIL TO THIS RECIPIENT (Tier 3a)",
    `The Sent folder holds ${signals.matchedMessageCount} recent email(s) to this exact recipient (from a ${signals.corpusSize}-message corpus).`,
    "",
    "How the user has written to THIS person:",
    renderFingerprint(signals.fingerprint),
  ].join("\n");
  return compose(base, guidance, section);
}

/** Tier 3b — tonally similar Gmail "Sent" mail (sent to other people). */
export function buildSentCorpusSimilarPrompt(
  base: PromptBase,
  signals: SentCorpusSignals
): ReasoningPrompt {
  const guidance =
    "No direct history with this recipient, but the user's recent sent mail contains tonally similar correspondence. Mirror that tone. These were sent to DIFFERENT people — adapt names and pleasantries to the current recipient.";
  const section = [
    "### CONVERSATION CONTEXT - TONALLY SIMILAR SENT MAIL (Tier 3b)",
    `From a ${signals.corpusSize}-message Sent corpus, the ${signals.matchedMessageCount} most tonally similar email(s) were selected.`,
    "These were sent to other people — adapt names and pleasantries to this recipient.",
    "",
    "Tone profile of the user's similar sent mail:",
    renderFingerprint(signals.fingerprint),
  ].join("\n");
  return compose(base, guidance, section);
}

/** Tier 3c — cold start, no usable corpus. */
export function buildColdStartPrompt(
  base: PromptBase,
  signals: ColdStartSignals
): ReasoningPrompt {
  const guidance =
    "Cold-start contact: no usable correspondence corpus. Use the user's general CommunicationProfile (greeting, sign-off, formality, sentence length) as your sole style guide. Hold a professional baseline.";
  const section = [
    "### CONVERSATION CONTEXT - COLD START (Tier 3c)",
    signals.reason,
    "There is no correspondence corpus to mimic — rely entirely on the user writing profile below.",
  ].join("\n");
  return compose(base, guidance, section);
}
