import type { GeneratedReply } from "../types";
import { buildDeclineServiceSchema } from "../router-tool";
import {
  EVERNOTE_FIELD_NAMES,
  isEvernoteHandoffComplete,
  hasMinimalProposalIdentity,
} from "../evernote-utils";
import { formatEvernotePayload } from "./evernote-payload";

export async function handleDeclineServiceTool(
  args: unknown,
  routeToOptions: readonly string[] = ["Dave"]
): Promise<GeneratedReply> {
  const parsed = buildDeclineServiceSchema(routeToOptions).parse(args);
  const details = parsed.extractedDetails;

  let evernotePayload: string | undefined;
  if (
    details &&
    isEvernoteHandoffComplete(details) &&
    hasMinimalProposalIdentity(details)
  ) {
    const priority = parsed.priority ?? "Low";
    const routeTo = parsed.routeTo ?? routeToOptions[0] ?? "Dave";
    const summary =
      parsed.summary?.trim() ||
      `Declined opportunity: ${parsed.reason}. Customer details gathered for team review.`;
    evernotePayload = formatEvernotePayload({
      fieldNames: EVERNOTE_FIELD_NAMES,
      details,
      recommendedNextStep: `Declined — ${parsed.reason}`,
      priority,
      routeTo,
      summary,
    });
    console.log(
      `[llm-orchestrator] Decline with Evernote — Priority: ${priority}, Route To: ${routeTo}`
    );
  } else if (details) {
    console.warn(
      "[llm-orchestrator] Decline without Evernote — intake not complete"
    );
  }

  return {
    replyText: parsed.emailDraft,
    evernotePayload,
    followUp: [`Out-of-scope request declined. Reason: ${parsed.reason}`],
  };
}
