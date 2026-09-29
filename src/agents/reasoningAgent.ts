import { getGeminiModel, geminiChatWithRetry } from "../config/gemini";
import { reasoningLlmOutputSchema } from "../lib/schemas/reasoning";
import type { ConversationContext } from "../lib/schemas/conversation-context";
import type { CleanedEmailMetadata } from "./parsingAgent";
import type { WritingDirectives } from "./mimicAgent";
import {
  buildColdStartPrompt,
  buildDirectHistoryPrompt,
  buildRelatedHistoryPrompt,
  buildSentCorpusSimilarPrompt,
  buildSentCorpusToSenderPrompt,
  type PromptBase,
  type ReasoningPrompt,
} from "./prompts/reasoning.prompts";

/**
 * Result of the single merged Reasoning call — classification + draft + safety
 * audit, all from one LLM round-trip.
 */
export interface ReasoningResult {
  inferredIntent: string;
  urgencyScore: number; // 0.0 to 1.0
  draftText: string;
  reasoningLog: string;
  confidence: number; // 0.0 to 1.0
  isSafe: boolean;
  violations: string[];
  /** The draft with any flagged secrets masked — equals `draftText` when safe. */
  redactedText: string;
}

export class ReasoningAgent {
  /**
   * Classifies the incoming email, drafts a personalized reply, and safety-audits
   * it — in ONE Gemini call. The prompt is selected by the resolved
   * {@link ConversationContext} tier so the draft mimics whichever corpus best
   * represents the user's voice for this recipient.
   */
  public static async reasonAndDraft(params: {
    parsedEmail: CleanedEmailMetadata;
    context: ConversationContext;
    directives: WritingDirectives;
  }): Promise<ReasoningResult> {
    const prompt = this.selectPrompt(
      { parsedEmail: params.parsedEmail, directives: params.directives },
      params.context
    );

    const response = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2560,
    });

    const parsed = reasoningLlmOutputSchema.parse(
      JSON.parse(response.choices[0].message.content || "{}")
    );

    const forbidden = params.directives.forbiddenList;
    const draftText = this.redactForbidden(parsed.draftText, forbidden);
    const redactedText = parsed.redactedText
      ? this.redactForbidden(parsed.redactedText, forbidden)
      : draftText;

    return {
      inferredIntent: parsed.inferredIntent,
      urgencyScore: parsed.urgencyScore,
      draftText,
      reasoningLog: this.normalizeLog(parsed.reasoningLog),
      confidence: parsed.confidence,
      isSafe: parsed.isSafe,
      violations: parsed.violations,
      redactedText,
    };
  }

  /** Dispatches to the prompt builder for the resolved tier. */
  private static selectPrompt(
    base: PromptBase,
    context: ConversationContext
  ): ReasoningPrompt {
    switch (context.tier) {
      case "direct_history":
        return buildDirectHistoryPrompt(base, context.signals);
      case "related_history":
        return buildRelatedHistoryPrompt(base, context.signals);
      case "sent_corpus_to_sender":
        return buildSentCorpusToSenderPrompt(base, context.signals);
      case "sent_corpus_similar":
        return buildSentCorpusSimilarPrompt(base, context.signals);
      case "cold_start":
        return buildColdStartPrompt(base, context.signals);
    }
  }

  /** Code-level failsafe — strips any forbidden word the LLM still emitted. */
  private static redactForbidden(
    text: string,
    forbiddenList: string[]
  ): string {
    let result = text;
    for (const forbidden of forbiddenList) {
      if (!forbidden.trim()) continue;
      const regex = new RegExp(`\\b${forbidden}\\b`, "gi");
      result = result.replace(regex, "");
    }
    return result;
  }

  /** Normalizes the model's free-form reasoning log into a single string. */
  private static normalizeLog(log: unknown): string {
    if (typeof log === "string" && log.trim()) {
      return log;
    }
    if (Array.isArray(log)) {
      return log.map((entry) => String(entry)).join("\n");
    }
    if (log && typeof log === "object") {
      return JSON.stringify(log, null, 2);
    }
    return "Draft formulated according to guidelines.";
  }
}
