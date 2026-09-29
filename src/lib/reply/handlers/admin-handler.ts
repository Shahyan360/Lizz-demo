import type { GeneratedReply } from "../types";
import {
  adminFollowupTemplateSchema,
  buildForwardAdminSchema,
} from "../router-tool";
import { ADMIN_FIELD_NAMES, isEvernoteHandoffComplete } from "../evernote-utils";
import { EVERNOTE_FORWARD } from "../business-knowledge";
import { getPrimaryTeamMemberForRole } from "../team-roster";
import { formatEvernotePayload } from "./evernote-payload";
import { blockedHandoffReply } from "../routing-rules";

export async function handleAdminFollowupTemplateTool(
  args: unknown
): Promise<GeneratedReply> {
  const parsed = adminFollowupTemplateSchema.parse(args);
  const missing = parsed.extractedDetails["Missing Information"] ?? "Unknown";
  console.log(`[llm-orchestrator] admin/CRM missing fields: ${missing}`);

  return {
    replyText: parsed.emailDraft,
    followUp: [
      "CRM/admin request — gathering details before Beverly can follow up.",
      "When complete, call forward_admin_to_evernote (Evernote + task for Beverly).",
    ],
  };
}

export async function handleForwardAdminTool(
  args: unknown
): Promise<GeneratedReply> {
  const parsed = buildForwardAdminSchema().parse(args);
  const adminHandler = await getPrimaryTeamMemberForRole("admin_handler");
  const routeTo = adminHandler?.name ?? "Beverly";
  const details = parsed.extractedDetails;

  if (!isEvernoteHandoffComplete(details)) {
    console.warn(
      "[llm-orchestrator] Blocked Evernote — admin intake incomplete"
    );
    return {
      replyText: blockedHandoffReply({
        kind: "admin",
        missingInformation: details["Missing Information"],
      }),
      followUp: ["Evernote blocked — admin Missing Information must be None."],
    };
  }

  const evernotePayload = formatEvernotePayload({
    fieldNames: ADMIN_FIELD_NAMES,
    details,
    recommendedNextStep: parsed.recommendedNextStep,
    priority: parsed.priority,
    routeTo,
    summary: parsed.summary,
  });
  const customer = details["Customer / Property"]?.trim() || "Customer";
  const requestType = details["Request Type"]?.trim() || "admin follow-up";

  console.log(
    `[llm-orchestrator] Admin handoff — Priority: ${parsed.priority}, ${routeTo} task + Evernote`
  );

  return {
    replyText: parsed.emailDraft,
    evernotePayload,
    ccTeammates: [routeTo],
    adminTask: {
      title: `${routeTo}: ${requestType} — ${customer}`,
      description: [
        parsed.summary,
        "",
        parsed.recommendedNextStep,
        "",
        ...ADMIN_FIELD_NAMES.map((f) => `${f}: ${details[f] ?? ""}`),
      ].join("\n"),
    },
    followUp: [
      `Evernote admin handoff sent to ${EVERNOTE_FORWARD.address}.`,
      `Task created for ${routeTo}: ${requestType} for ${customer}.`,
      parsed.recommendedNextStep,
    ],
  };
}
