import { Prisma, DraftStatus, ReviewLevel } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ParsingAgent } from "./parsingAgent";
import { MimicAgent } from "./mimicAgent";
import { ReasoningAgent } from "./reasoningAgent";
import { getGeminiModel } from "../config/gemini";
import { classifyEmail, type EmailCategory } from "../lib/email-classifier";
import { extractEmailAddress, NO_SUBJECT } from "../lib/gmail-helpers";
import {
  buildConversationContext,
  type ConversationContext,
  type SentCorpus,
} from "../lib/context-builder";
import {
  orchestratorInputSchema,
  orchestratorResultSchema,
  type OrchestratorInput,
  type OrchestratorResult,
} from "../lib/schemas/orchestrator";

export class MultiAgentOrchestrator {
  public static async execute(
    rawInput: OrchestratorInput,
    sentCorpus: SentCorpus
  ): Promise<OrchestratorResult> {
    const input = orchestratorInputSchema.parse(rawInput);

    const senderEmail = extractEmailAddress(input.sender);
    const senderName = input.sender.split("<")[0].trim() || senderEmail;

    const classification = classifyEmail({
      headers: input.headers ?? {},
      fromAddress: senderEmail,
      subject: input.subject ?? "",
      bodyText: input.rawBody,
      labelIds: input.labelIds ?? [],
    });

    const result = classification.shouldDraft
      ? await this.runDraftPipeline(input, sentCorpus, senderEmail, senderName)
      : await this.persistSkipped(input, senderEmail, senderName, {
          category: classification.category,
          reason: classification.reason,
        });

    return orchestratorResultSchema.parse(result);
  }

  private static async runDraftPipeline(
    input: OrchestratorInput,
    sentCorpus: SentCorpus,
    fallbackSenderEmail: string,
    fallbackSenderName: string
  ): Promise<OrchestratorResult> {
    const parseStart = Date.now();
    const parsedEmail = ParsingAgent.parse(input.rawBody, input.sender);
    const parseTime = Date.now() - parseStart;

    const senderEmail = parsedEmail.senderEmail || fallbackSenderEmail;
    const senderName = parsedEmail.senderName || fallbackSenderName;

    const contextStart = Date.now();
    const conversationContext = await buildConversationContext({
      senderEmail,
      cleanedText: parsedEmail.cleanedText,
      currentThreadId: input.threadId,
      sentCorpus,
    });
    const contextTime = Date.now() - contextStart;

    const mimicStart = Date.now();
    const writingDirectives = await MimicAgent.analyze();
    const mimicTime = Date.now() - mimicStart;

    const reasonStart = Date.now();
    const reasoningResult = await ReasoningAgent.reasonAndDraft({
      parsedEmail,
      context: conversationContext,
      directives: writingDirectives,
    });
    const reasonTime = Date.now() - reasonStart;

    const reviewLevel: ReviewLevel =
      reasoningResult.isSafe &&
      reasoningResult.confidence >= 0.85 &&
      reasoningResult.urgencyScore < 0.8
        ? ReviewLevel.AUTO_SEND
        : ReviewLevel.MANUAL_REVIEW;

    const finalDraftText = reasoningResult.redactedText;
    const model = getGeminiModel();

    return prisma.$transaction(async (tx) => {
      const contactId = await this.upsertContact(
        tx,
        senderEmail,
        senderName
      );
      const threadId = await this.upsertThread(tx, input);

      await tx.emailMessage.create({
        data: {
          threadId,
          contactId,
          sender: input.sender,
          subject: input.messageSubject ?? null,
          bodyText: parsedEmail.cleanedText,
          isIncoming: true,
          receivedAt: new Date(),
          sentiment: "neutral",
          intent: reasoningResult.inferredIntent,
          urgency: reasoningResult.urgencyScore,
        },
      });

      const savedDraft = await tx.emailDraft.create({
        data: {
          threadId,
          draftText: finalDraftText,
          status: DraftStatus.PENDING_REVIEW,
          reviewLevel,
          confidence: reasoningResult.confidence,
          reasoningLog: reasoningResult.reasoningLog,
        },
      });

      await tx.aITrace.createMany({
        data: [
          this.trace(savedDraft.id, "Parse", "deterministic", parsedEmail, parseTime),
          this.trace(savedDraft.id, "Memory", "postgres+qdrant", this.summarizeContext(conversationContext), contextTime),
          this.trace(savedDraft.id, "Mimic", "postgres", writingDirectives, mimicTime),
          this.trace(savedDraft.id, "Reasoning", model, reasoningResult, reasonTime),
        ],
      });

      await tx.emailThread.update({
        where: { id: threadId },
        data: {
          summary: `Intent: ${reasoningResult.inferredIntent}. Last Urgency: ${reasoningResult.urgencyScore}. Status: Draft Generated (${reviewLevel}).`,
        },
      });

      return {
        status: "drafted" as const,
        draftId: savedDraft.id,
        draftText: finalDraftText,
        confidence: reasoningResult.confidence,
        reviewLevel,
      };
    });
  }

  private static async persistSkipped(
    input: OrchestratorInput,
    senderEmail: string,
    senderName: string,
    classification: { category: EmailCategory; reason: string }
  ): Promise<OrchestratorResult> {
    const messageId = await prisma.$transaction(async (tx) => {
      const contactId = await this.upsertContact(
        tx,
        senderEmail,
        senderName
      );
      const threadId = await this.upsertThread(tx, input);

      const message = await tx.emailMessage.create({
        data: {
          threadId,
          contactId,
          sender: input.sender,
          subject: input.messageSubject ?? null,
          bodyText: input.rawBody,
          isIncoming: true,
          receivedAt: new Date(),
          intent: classification.category,
          urgency: 0,
        },
      });

      await tx.emailThread.update({
        where: { id: threadId },
        data: {
          summary: `No draft generated — ${classification.category} (${classification.reason}).`,
        },
      });

      return message.id;
    });

    return {
      status: "skipped",
      reason: classification.reason,
      category: classification.category,
      messageId,
    };
  }

  private static summarizeContext(
    context: ConversationContext
  ): Record<string, unknown> {
    return {
      tier: context.tier,
      sentCorpusContributed:
        context.tier === "sent_corpus_to_sender" ||
        context.tier === "sent_corpus_similar",
      signals: context.signals,
    };
  }

  private static async upsertContact(
    tx: Prisma.TransactionClient,
    email: string,
    name: string
  ): Promise<string> {
    const existing = await tx.contact.findUnique({
      where: { email },
    });

    if (existing) {
      await tx.contact.update({
        where: { id: existing.id },
        data: {
          interactionCount: { increment: 1 },
          lastInteractionAt: new Date(),
        },
      });
      return existing.id;
    }

    const created = await tx.contact.create({
      data: { email, name, interactionCount: 1, relationshipScore: 0.5 },
    });
    return created.id;
  }

  private static async upsertThread(
    tx: Prisma.TransactionClient,
    input: OrchestratorInput
  ): Promise<string> {
    const existing = await tx.emailThread.findUnique({
      where: { id: input.threadId },
    });
    if (existing) {
      return existing.id;
    }

    const account =
      (await tx.gmailAccount.findFirst({
        where: { isActive: true },
      })) ??
      (await tx.gmailAccount.findFirst());

    const created = await tx.emailThread.create({
      data: {
        id: input.threadId,
        gmailAccountId: account?.id ?? null,
        subject: input.subject ?? NO_SUBJECT,
        snippet: input.snippet ?? null,
      },
    });
    return created.id;
  }

  private static trace(
    draftId: string,
    pipelineStep: string,
    modelName: string,
    payload: unknown,
    latencyMs: number
  ): Prisma.AITraceCreateManyInput {
    return {
      draftId,
      pipelineStep,
      modelName,
      promptText: pipelineStep,
      responseText: JSON.stringify(payload),
      tokenInput: 0,
      tokenOutput: 0,
      latencyMs,
    };
  }
}
