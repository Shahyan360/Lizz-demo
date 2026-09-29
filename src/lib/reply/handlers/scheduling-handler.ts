import type { GeneratedReply } from "../types";
import {
  schedulingTemplateSchema,
  buildForwardSchedulingSchema,
} from "../router-tool";
import {
  SCHEDULING_FIELD_NAMES,
  isEvernoteHandoffComplete,
} from "../evernote-utils";
import { EVERNOTE_FORWARD } from "../business-knowledge";
import { getPrimaryTeamMemberForRole } from "../team-roster";
import { formatEvernotePayload } from "./evernote-payload";
import { blockedHandoffReply } from "../routing-rules";

export async function handleSchedulingTemplateTool(
  args: unknown
): Promise<GeneratedReply> {
  const parsed = schedulingTemplateSchema.parse(args);
  const missing = parsed.extractedDetails["Missing Information"] ?? "Unknown";
  console.log(`[llm-orchestrator] scheduling missing fields: ${missing}`);

  return {
    replyText: parsed.emailDraft,
    followUp: [
      "Scheduling request — gathering details before Sarah can schedule.",
      "When the customer replies with all scheduling info, call forward_scheduling_to_evernote (Evernote + task for Sarah).",
    ],
  };
}

export async function handleForwardSchedulingTool(
  args: unknown
): Promise<GeneratedReply> {
  const parsed = buildForwardSchedulingSchema().parse(args);
  const scheduler = await getPrimaryTeamMemberForRole("scheduler");
  const routeTo = scheduler?.name ?? "Sarah";
  const details = parsed.extractedDetails;

  if (!isEvernoteHandoffComplete(details)) {
    console.warn(
      "[llm-orchestrator] Blocked Evernote — scheduling intake incomplete"
    );
    return {
      replyText: blockedHandoffReply({
        kind: "scheduling",
        missingInformation: details["Missing Information"],
      }),
      followUp: [
        "Evernote blocked — scheduling Missing Information must be None.",
      ],
    };
  }

  const evernotePayload = formatEvernotePayload({
    fieldNames: SCHEDULING_FIELD_NAMES,
    details,
    recommendedNextStep: parsed.recommendedNextStep,
    priority: parsed.priority,
    routeTo,
    summary: parsed.summary,
  });
  const customer = details["Customer / Property"]?.trim() || "Customer";
  const meetingType = details["Meeting Type"]?.trim() || "meeting";

  console.log(
    `[llm-orchestrator] Scheduling handoff — Priority: ${parsed.priority}, ${routeTo} task + Evernote`
  );

  return {
    replyText: parsed.emailDraft,
    evernotePayload,
    ccTeammates: [routeTo],
    schedulingTask: {
      title: `${routeTo}: Schedule ${meetingType} — ${customer}`,
      description: [
        parsed.summary,
        "",
        parsed.recommendedNextStep,
        "",
        ...SCHEDULING_FIELD_NAMES.map((f) => `${f}: ${details[f] ?? ""}`),
      ].join("\n"),
    },
    followUp: [
      `Evernote scheduling handoff sent to ${EVERNOTE_FORWARD.address}.`,
      `Task created for ${routeTo}: schedule ${meetingType} with ${customer}.`,
      parsed.recommendedNextStep,
    ],
  };
}
