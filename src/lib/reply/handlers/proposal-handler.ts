import type { GeneratedReply } from "../types";
import {
  proposalTemplateSchema,
  buildForwardToEvernoteSchema,
  videoSurveillanceTemplateSchema,
} from "../router-tool";
import {
  EVERNOTE_FIELD_NAMES,
  isEvernoteHandoffComplete,
  hasMinimalProposalIdentity,
  resolveProposalPriority,
} from "../evernote-utils";
import { EVERNOTE_FORWARD } from "../business-knowledge";
import { getPrimaryTeamMemberForRole } from "../team-roster";
import {
  markMissingClaimedAttachments,
  markPhotosProvidedFromAttachments,
  stripPhotoAsksFromDraft,
  ensureMissingAttachmentAskInDraft,
  claimedAttachmentsMissing,
} from "../attachment-awareness";
import { formatEvernotePayload } from "./evernote-payload";
import { blockedHandoffReply } from "../routing-rules";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function handleProposalTemplateTool(
  args: unknown,
  attachmentNames: string[] = [],
  bodyText = "",
  customerName?: string,
  customerEmail?: string
): Promise<GeneratedReply> {
  const parsed = proposalTemplateSchema.parse(args);
  const details = markMissingClaimedAttachments(
    markPhotosProvidedFromAttachments(parsed.extractedDetails, attachmentNames),
    bodyText,
    attachmentNames
  ) as typeof parsed.extractedDetails;
  const missing = details["Missing Information"] ?? "Unknown";
  console.log(`[llm-orchestrator] missing fields: ${missing}`);

  const evernoteStep =
    `Forward details to Evernote task inbox when the customer replies ` +
    `(subject prefix: "${EVERNOTE_FORWARD.subjectSuffix}").`;

  let replyText = "";

  if (customerEmail) {
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await prisma.quoteRequest.create({
        data: {
          token,
          customerName: customerName?.trim() || "Valued Customer",
          customerEmail: customerEmail.trim().toLowerCase(),
          expiresAt,
        },
      });

      const baseUrl =
        process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
        process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
        "http://localhost:3000";

      const link = `${baseUrl}/quote-builder/${token}`;
      const firstName = customerName ? customerName.split(" ")[0].trim() : "";
      const greeting = firstName ? `Hi ${firstName},\n\n` : "Hi,\n\n";

      replyText = `${greeting}Thanks for reaching out about your project. To get you a price estimate as quickly as possible, we've created a personalized Quote Builder link where you can select the products you need:\n\n${link}\n\nOnce you submit your selections, a draft quotation will be generated in Zoho Books and emailed to you automatically.\n\nIf you have any questions or photos to share, feel free to reply directly to this email.\n\nBest regards,\nLizzz`;
    } catch (dbErr) {
      console.error("[proposal-handler] Failed to create quote link in DB:", dbErr);
    }
  }

  if (!replyText) {
    replyText = stripPhotoAsksFromDraft(parsed.emailDraft, attachmentNames);
    replyText = ensureMissingAttachmentAskInDraft(
      replyText,
      bodyText,
      attachmentNames
    );
  }

  return {
    replyText,
    followUp: [
      evernoteStep,
      "When they reply with details, forward to Evernote and review for onboarding.",
      ...(attachmentNames.length
        ? [`Inbound attachments already received: ${attachmentNames.join(", ")}.`]
        : claimedAttachmentsMissing(bodyText, attachmentNames)
          ? ["Customer claimed attachment but none arrived — asked to re-attach."]
          : []),
    ],
  };
}

export async function handleForwardToEvernoteTool(
  args: unknown,
  routeToOptions: readonly string[]
): Promise<GeneratedReply> {
  const parsed = buildForwardToEvernoteSchema(routeToOptions).parse(args);
  const details = parsed.extractedDetails;

  if (
    !isEvernoteHandoffComplete(details) ||
    !hasMinimalProposalIdentity(details)
  ) {
    const missing = details["Missing Information"] ?? "(empty)";
    console.warn(
      `[llm-orchestrator] Blocked Evernote — intake incomplete (Missing: ${missing})`
    );
    return {
      replyText: blockedHandoffReply({
        kind: "proposal",
        missingInformation: missing,
      }),
      followUp: [
        "Evernote blocked — gather all proposal fields first (Missing Information must be None).",
      ],
    };
  }

  const priority = resolveProposalPriority(details);
  const proposalReviewer = await getPrimaryTeamMemberForRole("proposal_reviewer");
  const routeTo =
    parsed.routeTo || proposalReviewer?.name || routeToOptions[0] || "Dave";
  if (priority !== parsed.priority) {
    console.log(
      `[llm-orchestrator] Priority corrected ${parsed.priority} → ${priority}`
    );
  }

  const evernotePayload = formatEvernotePayload({
    fieldNames: EVERNOTE_FIELD_NAMES,
    details,
    recommendedNextStep: parsed.recommendedNextStep,
    priority,
    routeTo,
    summary: parsed.summary,
  });

  const customer = details["Customer / Property"]?.trim() || "Customer";

  console.log(
    `[llm-orchestrator] Evernote handoff — Priority: ${priority}, Route To: ${routeTo}`
  );

  return {
    replyText: parsed.emailDraft,
    evernotePayload,
    proposalTask: {
      title: `${routeTo}: Proposal — ${customer}`,
      description: [
        parsed.summary,
        "",
        parsed.recommendedNextStep,
        "",
        ...EVERNOTE_FIELD_NAMES.map((f) => `${f}: ${details[f] ?? ""}`),
      ].join("\n"),
      assignee: routeTo,
      priority: (priority as string) === "Urgent" || (priority as string) === "High" ? "HIGH" : "MEDIUM",
    },
    ...(routeTo === "Beverly" ? { ccTeammates: ["Beverly"] } : {}),
    followUp: [
      `Evernote handoff sent to ${EVERNOTE_FORWARD.address}.`,
      `Task created for ${routeTo}: proposal review for ${customer}.`,
      parsed.recommendedNextStep,
    ],
  };
}

export async function handleVideoSurveillanceTemplateTool(
  args: unknown,
  attachmentNames: string[] = [],
  bodyText = ""
): Promise<GeneratedReply> {
  const parsed = videoSurveillanceTemplateSchema.parse(args);
  const details = markMissingClaimedAttachments(
    markPhotosProvidedFromAttachments(parsed.extractedDetails, attachmentNames),
    bodyText,
    attachmentNames
  ) as typeof parsed.extractedDetails;
  const missing = details["Missing Information"] ?? "Unknown";
  console.log(`[llm-orchestrator] video surveillance missing fields: ${missing}`);

  let replyText = stripPhotoAsksFromDraft(parsed.emailDraft, attachmentNames);
  replyText = ensureMissingAttachmentAskInDraft(
    replyText,
    bodyText,
    attachmentNames
  );

  const proposalReviewer = await getPrimaryTeamMemberForRole("proposal_reviewer");
  const reviewerLabel = proposalReviewer?.name
    ? `${proposalReviewer.name}'s`
    : "the Proposal Review primary's";

  return {
    replyText,
    followUp: [
      `Video surveillance scope — gathered scope & photo requirements. Missing: ${missing}`,
      `When the customer replies with details, call forward_to_evernote for ${reviewerLabel} proposal review.`,
    ],
  };
}
