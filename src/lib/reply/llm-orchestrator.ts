import { getGeminiModel, geminiChatWithRetry } from "../../config/gemini";
import { buildContactContext } from "./contact-history";
import { buildPropertyContext } from "./property-context";
import { buildRelatedReplyExamples } from "./related-history";
import { fetchReplyAttachments } from "./attachments";
import {
  buildAttachmentNote,
  claimedAttachmentsMissing,
  markMissingClaimedAttachments,
  markPhotosProvidedFromAttachments,
} from "./attachment-awareness";
import { stripQuotedText } from "../email/strip-quoted";
import { buildPhase2SystemPrompt } from "../training/router-system";
import {
  isBrandNewResidentialGateInstall,
  resolveProposalPriority,
} from "./evernote-utils";
import {
  getPrimaryTeamMemberForRole,
  getTeamNames,
  getTeamRoster,
} from "./team-roster";
import { buildRoutingPromptBlock } from "./team-routing";
import {
  toolsForPhase2,
  buildForwardToEvernoteSchema,
  getEscapeHatchAction,
  type EmailAction,
} from "./router-tool";
import type { GeneratedReply } from "./types";
import {
  withAttachmentAwareness,
  routeEmailAction,
  correctProposalRouting,
  correctDuplicateHandoffRouting,
  withoutDuplicateEvernote,
} from "./routing-rules";
import {
  handleProposalTemplateTool,
  handleForwardToEvernoteTool,
  handleSchedulingTemplateTool,
  handleForwardSchedulingTool,
  handleAdminFollowupTemplateTool,
  handleForwardAdminTool,
  handleVideoSurveillanceTemplateTool,
  handleDeclineServiceTool,
  handleProductInformationTool,
  handleDraftCustomReplyTool,
  handleCreateQuoteLinkEmailTool,
} from "./handlers";

export type { GeneratedReply };

/** Converts plain text to HTML with clean paragraph and line breaks. */
export function replyTextToHtml(text: string): string {
  if (!text) return "";

  // 1. Fix missing space between period and capital letter (e.g. "causing.We" -> "causing. We")
  let formatted = text.replace(/([a-z0-9\.:\?!])([A-Z][a-z])/g, "$1 $2");

  // 2. Fix missing line break after greeting (e.g., "Dear Jennifer,Thank" -> "Dear Jennifer,\n\nThank")
  formatted = formatted.replace(
    /^(Hi|Dear|Hello|Thanks)( [^,\n]+)?,([^\s\n])/i,
    "$1$2,\n\n$3"
  );

  // 3. Fix missing line break before sign-off (e.g., "visit.Lizzz" -> "visit.\n\nLizzz")
  formatted = formatted.replace(
    /([.\?!])\s*(Lizzz|Thanks|Best regards|Sincerely)\b/gi,
    "$1\n\n$2"
  );

  // 4. Split by double or single line breaks into clean HTML paragraphs
  return formatted
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const clean = paragraph.trim().replace(/\n/g, "<br>");
      return clean ? `<p>${clean}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

export async function processEmailWithLLM(input: {
  senderName: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  messageId?: string;
  folderId?: string;
  accountId?: string;
  threadId?: string;
}): Promise<GeneratedReply> {
  const newMessage = stripQuotedText(input.bodyText);

  // 1. Fetch external data
  const [contactContext, propertyContext, relatedReplyExamples, attachments] = await Promise.all([
    buildContactContext({
      fromAddress: input.fromAddress,
      bodyText: input.bodyText,
      currentMessageId: input.messageId,
    }),
    buildPropertyContext(input.fromAddress),
    buildRelatedReplyExamples({
      queryText: newMessage,
      currentThreadId: input.threadId,
    }),
    input.messageId && input.folderId
      ? fetchReplyAttachments({
          messageId: input.messageId,
          folderId: input.folderId,
          accountId: input.accountId,
        })
      : Promise.resolve([]),
  ]);

  // 2. Format exact JSON payload for the LLM
  const attachmentNames = attachments.map((a) => a.name).filter(Boolean);
  if (attachmentNames.length) {
    console.log(
      `[llm-orchestrator] inbound attachments (${attachmentNames.length}): ${attachmentNames.join(", ")}`
    );
  } else if (claimedAttachmentsMissing(newMessage, attachmentNames)) {
    console.log(
      "[llm-orchestrator] customer claimed attachment but none found on email"
    );
  }

  const basePayloadFields = {
    contactHistory: contactContext || "No previous contact history.",
    threadDetails: {
      sender: `${input.senderName} <${input.fromAddress}>`,
      subject: input.subject,
      body: newMessage,
    },
    attachments: attachmentNames,
    attachmentsPresent: attachmentNames.length > 0,
    attachmentClaimedButMissing: claimedAttachmentsMissing(
      newMessage,
      attachmentNames
    ),
    attachmentNote: buildAttachmentNote(newMessage, attachmentNames),
  };

  // Phase 1's routing decision never uses property context (it's informational
  // for the reply's wording only — see PROPERTY CONTEXT in router-system.ts),
  // so the cheap router call is kept lean and only Phase 2 pays for it.
  const phase1Payload = JSON.stringify(basePayloadFields, null, 2);
  const llmPayload = JSON.stringify(
    {
      ...basePayloadFields,
      propertyContext: propertyContext || "No known property record for this contact.",
      ...(relatedReplyExamples ? { relatedReplyExamples } : {}),
    },
    null,
    2
  );

  const images = attachments.filter((a) => a.dataUri);
  const userContent = images.length
    ? [
        { type: "text" as const, text: llmPayload },
        ...images.map((a) => ({
          type: "image_url" as const,
          image_url: { url: a.dataUri as string },
        })),
      ]
    : llmPayload;

  const LLM_PHASE2_MAX_ATTEMPTS = 2;
  const LLM_PHASE2_RETRY_DELAY_MS = 2000;

  let action: EmailAction;
  let tools: ReturnType<typeof toolsForPhase2>;
  const roster = await getTeamRoster();
  const teamNames = await getTeamNames();
  const routeToOptions =
    teamNames.length > 0 ? teamNames : roster.map((member) => member.name);
  const routingPrompt = buildRoutingPromptBlock(roster);

  try {
    action = await routeEmailAction(phase1Payload, routingPrompt);
    action = correctProposalRouting(action, llmPayload, contactContext);
    action = correctDuplicateHandoffRouting(action, contactContext);
    tools = toolsForPhase2(action, routeToOptions);
    console.log(
      `[llm-orchestrator] Phase 2 — ${action} (${tools.length} tool(s), lightweight phase 1 router)`
    );
  } catch (routeErr) {
    console.error(
      "\n" +
        "╔══════════════════════════════════════════════════════════════╗\n" +
        "║  ❌  LLM FAILURE — Phase 1 routing failed                   ║\n" +
        "║  No email will be sent. Manual review required.             ║\n" +
        "╚══════════════════════════════════════════════════════════════╝",
      routeErr
    );
    return {
      replyText: "",
      followUp: ["Phase 1 routing failed — manual review required."],
      llmFailed: true,
    };
  }

  let toolCall: any | undefined;
  let response: any;

  const phase2Prompt = buildPhase2SystemPrompt(
    action,
    routingPrompt,
    getEscapeHatchAction(action),
    Boolean(propertyContext),
    Boolean(relatedReplyExamples)
  );
  for (let attempt = 1; attempt <= LLM_PHASE2_MAX_ATTEMPTS; attempt++) {
    try {
      response = await geminiChatWithRetry({
        model: getGeminiModel(),
        messages: [
          { role: "system", content: phase2Prompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: "required",
        temperature: 0.3,
      });

      toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        break; // success
      }

      console.warn(
        `[llm-orchestrator] Phase 2 attempt ${attempt}/${LLM_PHASE2_MAX_ATTEMPTS}: no tool call returned.`
      );
    } catch (err) {
      console.warn(
        `[llm-orchestrator] Phase 2 attempt ${attempt}/${LLM_PHASE2_MAX_ATTEMPTS} threw:`,
        err
      );
    }

    if (attempt < LLM_PHASE2_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, LLM_PHASE2_RETRY_DELAY_MS));
    }
  }

  if (!toolCall) {
    console.error(
      "\n" +
        "╔══════════════════════════════════════════════════════════════╗\n" +
        `║  ❌  LLM FAILURE — no tool call after ${LLM_PHASE2_MAX_ATTEMPTS} attempt(s)            ║\n` +
        "║  No email will be sent. Manual review required.             ║\n" +
        "╚══════════════════════════════════════════════════════════════╝"
    );
    return {
      replyText: "",
      followUp: [
        `LLM returned no tool call after ${LLM_PHASE2_MAX_ATTEMPTS} attempts — manual review required. NO EMAIL WAS SENT.`,
      ],
      llmFailed: true,
    };
  }

  try {
    const toolName = toolCall.function.name as EmailAction;
    const toolArgs = JSON.parse(toolCall.function.arguments);
    console.log(`[llm-orchestrator] Tool selected: ${toolName}`);

    const finalize = (result: GeneratedReply): GeneratedReply =>
      withAttachmentAwareness(result, attachmentNames, newMessage);

    const withAttachmentDetails = (
      details: Record<string, string | undefined> | undefined
    ): Record<string, string | undefined> | undefined => {
      if (!details) return details;
      return markMissingClaimedAttachments(
        markPhotosProvidedFromAttachments(details, attachmentNames),
        newMessage,
        attachmentNames
      );
    };

    if (toolName === "create_quote_link") {
      return finalize(
        await handleCreateQuoteLinkEmailTool(
          toolArgs,
          input.senderName,
          input.fromAddress
        )
      );
    } else if (toolName === "create_proposal_template") {
      return finalize(
        await handleProposalTemplateTool(
          {
            ...toolArgs,
            extractedDetails: withAttachmentDetails(toolArgs.extractedDetails),
          },
          attachmentNames,
          newMessage,
          input.senderName,
          input.fromAddress
        )
      );
    } else if (toolName === "forward_to_evernote") {
      const parsed = buildForwardToEvernoteSchema(routeToOptions).parse(
        toolArgs
      );
      const details = withAttachmentDetails(parsed.extractedDetails) as Record<
        string,
        string
      >;
      if (isBrandNewResidentialGateInstall(details)) {
        console.log(
          "[llm-orchestrator] redirect forward_to_evernote → decline_service (brand-new install)"
        );
        const proposalReviewer = await getPrimaryTeamMemberForRole(
          "proposal_reviewer"
        );
        return finalize(
          withoutDuplicateEvernote(
            await handleDeclineServiceTool(
              {
                reason:
                  "Brand-new residential gate installation — not currently performed",
                extractedDetails: details,
                priority: resolveProposalPriority(details),
                routeTo:
                  parsed.routeTo ??
                  proposalReviewer?.name ??
                  routeToOptions[0] ??
                  "Dave",
                summary: parsed.summary,
                emailDraft: parsed.emailDraft,
              },
              routeToOptions
            ),
            contactContext,
            "proposal"
          )
        );
      }
      return finalize(
        withoutDuplicateEvernote(
          await handleForwardToEvernoteTool(
            {
              ...toolArgs,
              extractedDetails: details,
            },
            routeToOptions
          ),
          contactContext,
          "proposal"
        )
      );
    } else if (toolName === "create_scheduling_template") {
      return finalize(await handleSchedulingTemplateTool(toolArgs));
    } else if (toolName === "forward_scheduling_to_evernote") {
      return finalize(
        withoutDuplicateEvernote(
          await handleForwardSchedulingTool(toolArgs),
          contactContext,
          "scheduling"
        )
      );
    } else if (toolName === "create_admin_followup_template") {
      return finalize(await handleAdminFollowupTemplateTool(toolArgs));
    } else if (toolName === "forward_admin_to_evernote") {
      return finalize(
        withoutDuplicateEvernote(
          await handleForwardAdminTool(toolArgs),
          contactContext,
          "admin"
        )
      );
    } else if (toolName === "create_video_surveillance_template") {
      return finalize(
        await handleVideoSurveillanceTemplateTool(
          {
            ...toolArgs,
            extractedDetails: withAttachmentDetails(toolArgs.extractedDetails),
          },
          attachmentNames,
          newMessage
        )
      );
    } else if (toolName === "decline_service") {
      return finalize(
        withoutDuplicateEvernote(
          await handleDeclineServiceTool(
            {
              ...toolArgs,
              extractedDetails: withAttachmentDetails(toolArgs.extractedDetails),
            },
            routeToOptions
          ),
          contactContext,
          "proposal"
        )
      );
    } else if (toolName === "get_product_information") {
      return finalize(await handleProductInformationTool(toolArgs));
    } else if (toolName === "draft_custom_reply") {
      return finalize(
        await handleDraftCustomReplyTool(toolArgs, routeToOptions)
      );
    }

    const unknownToolStr = String(toolName);
    console.error(
      "\n" +
        "╔══════════════════════════════════════════════════════════════╗\n" +
        `║  ❌  LLM FAILURE — unknown tool returned: ${unknownToolStr.padEnd(19)}║\n` +
        "║  No email will be sent. Manual review required.             ║\n" +
        "╚══════════════════════════════════════════════════════════════╝"
    );
    return {
      replyText: "",
      followUp: [
        `Unknown tool called: ${unknownToolStr} — manual review required. NO EMAIL WAS SENT.`,
      ],
      llmFailed: true,
    };
  } catch (err) {
    console.error(
      "\n" +
        "╔══════════════════════════════════════════════════════════════╗\n" +
        "║  ❌  LLM FAILURE — tool execution threw an error            ║\n" +
        "║  No email will be sent. Manual review required.             ║\n" +
        "╚══════════════════════════════════════════════════════════════╝",
      err
    );
    return {
      replyText: "",
      followUp: [
        "Tool execution failed — manual review required. NO EMAIL WAS SENT.",
      ],
      llmFailed: true,
    };
  }
}