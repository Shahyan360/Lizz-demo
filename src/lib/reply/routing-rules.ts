import type { GeneratedReply } from "./types";
import { getGeminiModel, geminiChatWithRetry } from "../../config/gemini";
import { ROUTER_LIGHTWEIGHT_PROMPT } from "../training/router-system";
import {
  EMAIL_ROUTE_JSON_SUFFIX,
  isEmailAction,
  type EmailAction,
} from "./router-tool";
import {
  isNewInstallReadyForDecline,
  wasDeclineAlreadySent,
  wasProposalHandoffAlreadySent,
  wasSchedulingHandoffAlreadySent,
  wasAdminHandoffAlreadySent,
} from "./evernote-utils";
import {
  hasInboundAttachments,
  stripPhotoAsksFromDraft,
  claimedAttachmentsMissing,
  ensureMissingAttachmentAskInDraft,
} from "./attachment-awareness";

export function withAttachmentAwareness(
  result: GeneratedReply,
  attachmentNames: string[],
  bodyText: string
): GeneratedReply {
  let replyText = result.replyText;
  const notes: string[] = [];

  if (hasInboundAttachments(attachmentNames)) {
    const stripped = stripPhotoAsksFromDraft(replyText, attachmentNames);
    if (stripped !== replyText) {
      console.log(
        "[llm-orchestrator] stripped photo/attachment asks — files already on email"
      );
      notes.push(
        `Attachments already on email (${attachmentNames.join(", ")}) — did not re-ask for files.`
      );
    } else {
      notes.push(`Inbound attachments noted: ${attachmentNames.join(", ")}.`);
    }
    replyText = stripped;
  } else if (claimedAttachmentsMissing(bodyText, attachmentNames)) {
    const nudged = ensureMissingAttachmentAskInDraft(
      replyText,
      bodyText,
      attachmentNames
    );
    if (nudged !== replyText) {
      console.log(
        "[llm-orchestrator] customer claimed attachment but none found — asked to re-attach"
      );
    }
    notes.push(
      "Customer claimed an attachment but none arrived — asked them to re-attach."
    );
    replyText = nudged;
  }

  if (notes.length === 0) return result;
  return {
    ...result,
    replyText,
    followUp: [...result.followUp, ...notes],
  };
}

export async function routeEmailAction(
  llmPayload: string,
  routingPrompt: string
): Promise<EmailAction> {
  try {
    const response = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages: [
        {
          role: "system",
          content: `${ROUTER_LIGHTWEIGHT_PROMPT}\n\n${routingPrompt}${EMAIL_ROUTE_JSON_SUFFIX}`,
        },
        { role: "user", content: llmPayload },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return "draft_custom_reply";
    const parsed = JSON.parse(raw) as { action?: string };
    const action = parsed.action?.trim();
    if (action && isEmailAction(action)) return action;
    console.warn(
      `[llm-orchestrator] router unknown action: ${action ?? "(missing)"}`
    );
  } catch (err) {
    console.warn("[llm-orchestrator] router failed:", err);
  }
  return "draft_custom_reply";
}

const NEW_INSTALL_RE =
  /\b(new\s+(gate\s+)?install(ation)?|install\s+a\s+new\s+gate|need\s+details\s+for\s+a\s+new|new\s+(automatic\s+|driveway\s+|residential\s+)?gate(s)?)\b/i;

const PRICE_ESTIMATE_RE =
  /\b(price\s+estimate|price\s+quote|get\s+an\s+estimate|ballpark|pricing|quote|cost\s+for|estimate\s+for|how\s+much\s+(is|for|does)|quotation)\b/i;

export function correctProposalRouting(
  action: EmailAction,
  llmPayload: string,
  contactHistory: string
): EmailAction {
  let body = "";
  try {
    body = String(JSON.parse(llmPayload).threadDetails?.body ?? "");
  } catch {
    // ignore
  }

  const history = `${contactHistory}\n${body}`.toLowerCase();

  if (
    (PRICE_ESTIMATE_RE.test(body) || NEW_INSTALL_RE.test(body)) &&
    !history.includes("quote builder link") &&
    (action === "create_proposal_template" ||
      action === "draft_custom_reply" ||
      action === "decline_service")
  ) {
    return "create_quote_link";
  }

  if (action === "decline_service") {
    if (
      wasDeclineAlreadySent(contactHistory) ||
      history.includes("residential gate and call box proposal request")
    ) {
      return action;
    }

    const UNSUPPORTED_SERVICE_RE = /\b(automatic\s+door(s)?|garage\s+door(s)?|wooden\s+gate(s)?|(non-automated\s+|wooden\s+|manual\s+)?fence(s)?|fence\s+(install(ation)?|repair))\b/i;
    const hasPriorLizzzReply = /\[FROM Lizzz \(our reply\)\]/i.test(contactHistory);
    if (UNSUPPORTED_SERVICE_RE.test(body) && !hasPriorLizzzReply) {
      return "draft_custom_reply";
    }

    if (NEW_INSTALL_RE.test(body)) {
      console.log(
        "[llm-orchestrator] override decline_service → create_quote_link (send quote builder link)"
      );
      return "create_quote_link";
    }
    return action;
  }

  if (
    action === "forward_to_evernote" &&
    isNewInstallReadyForDecline(llmPayload, contactHistory)
  ) {
    if (wasDeclineAlreadySent(contactHistory)) {
      console.log(
        "[llm-orchestrator] override forward_to_evernote → draft_custom_reply (decline already sent)"
      );
      return "draft_custom_reply";
    }
    console.log(
      "[llm-orchestrator] override forward_to_evernote → decline_service (brand-new install, intake complete)"
    );
    return "decline_service";
  }

  const isTemplateAction =
    action === "create_proposal_template" ||
    action === "create_video_surveillance_template" ||
    action === "create_admin_followup_template";

  if (
    isTemplateAction &&
    contactHistory &&
    /\[FROM Lizzz \(our reply\)\]/i.test(contactHistory)
  ) {
    console.log(
      `[llm-orchestrator] override ${action} → draft_custom_reply (template/intake already sent in thread)`
    );
    return "draft_custom_reply";
  }

  return action;
}

export function correctDuplicateHandoffRouting(
  action: EmailAction,
  contactHistory: string
): EmailAction {
  if (
    action === "forward_to_evernote" &&
    wasProposalHandoffAlreadySent(contactHistory)
  ) {
    console.log(
      "[llm-orchestrator] override forward_to_evernote → draft_custom_reply (already handed off)"
    );
    return "draft_custom_reply";
  }
  if (
    action === "forward_scheduling_to_evernote" &&
    wasSchedulingHandoffAlreadySent(contactHistory)
  ) {
    console.log(
      "[llm-orchestrator] override forward_scheduling_to_evernote → draft_custom_reply (already handed off)"
    );
    return "draft_custom_reply";
  }
  if (
    action === "forward_admin_to_evernote" &&
    wasAdminHandoffAlreadySent(contactHistory)
  ) {
    console.log(
      "[llm-orchestrator] override forward_admin_to_evernote → draft_custom_reply (already handed off)"
    );
    return "draft_custom_reply";
  }
  return action;
}

export function withoutDuplicateEvernote(
  result: GeneratedReply,
  contactHistory: string,
  kind: "proposal" | "scheduling" | "admin"
): GeneratedReply {
  if (!result.evernotePayload) return result;

  const duplicate =
    kind === "proposal"
      ? wasProposalHandoffAlreadySent(contactHistory)
      : kind === "scheduling"
        ? wasSchedulingHandoffAlreadySent(contactHistory)
        : wasAdminHandoffAlreadySent(contactHistory);

  if (!duplicate) return result;

  console.warn(
    `[llm-orchestrator] Blocked duplicate ${kind} Evernote handoff`
  );
  return {
    ...result,
    replyText: [
      "Thanks for the update.",
      "I've added this to the existing review thread for the team.",
      "If anything else is needed, we'll follow up with you.",
      "",
      "Lizzz",
    ].join("\n"),
    evernotePayload: undefined,
    ccTeammates: undefined,
    schedulingTask: undefined,
    adminTask: undefined,
    followUp: [
      ...result.followUp,
      `Evernote skipped — ${kind} details were already forwarded to the team.`,
    ],
  };
}

export function blockedHandoffReply(input: {
  kind: "proposal" | "scheduling" | "admin";
  missingInformation: string | undefined;
}): string {
  const missing = (input.missingInformation ?? "").trim();
  const label =
    input.kind === "proposal"
      ? "project details"
      : input.kind === "scheduling"
        ? "scheduling details"
        : "request details";

  if (missing && missing.toLowerCase() !== "none") {
    return [
      "Thanks for the information.",
      `To make sure I send everything to the team correctly, I still need the following ${label}: ${missing}.`,
      "Once I have that, I'll forward everything for review.",
      "",
      "Lizzz",
    ].join("\n");
  }

  return [
    "Thanks for the information.",
    `I'm still organizing a few final ${label} before I forward this to the team.`,
    "As soon as I have everything in the right format, I'll send it over for review.",
    "",
    "Lizzz",
  ].join("\n");
}
