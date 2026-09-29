import type { GeneratedReply } from "../types";
import { buildDraftCustomReplySchema } from "../router-tool";
import { getTeamNames } from "../team-roster";
import { formatEvernotePayload } from "./evernote-payload";

export async function handleDraftCustomReplyTool(
  args: unknown,
  routeToOptions: readonly string[]
): Promise<GeneratedReply> {
  const parsed = buildDraftCustomReplySchema(routeToOptions).parse(args);

  const teamNames = await getTeamNames();
  console.log(
    `[llm-orchestrator] Active team for routing: ${teamNames.join(", ")}`
  );

  let evernotePayload: string | undefined;
  if (parsed.routeTo) {
    const priority = parsed.priority ?? "Normal";
    const summary =
      parsed.nextAction || `Follow up requested for ${parsed.routeTo}.`;
    evernotePayload = formatEvernotePayload({
      details: parsed.extractedDetails,
      recommendedNextStep: summary,
      priority,
      routeTo: parsed.routeTo,
      summary,
    });
    console.log(
      `[llm-orchestrator] Custom reply handoff — Route To: ${parsed.routeTo}, Priority: ${priority}`
    );
  }

  return {
    replyText: parsed.emailDraft,
    evernotePayload,
    followUp: parsed.nextAction ? [parsed.nextAction] : [],
  };
}
