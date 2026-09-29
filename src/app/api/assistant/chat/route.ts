import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "../../../../lib/auth/options";
import { geminiChatWithRetry, getGeminiModel, isGeminiKey } from "../../../../config/gemini";
import { extractSpeakSummary, formatSpeakReply } from "./utils";
import { buildMainSystemPrompt } from "./prompts";
import { ASSISTANT_TOOLS } from "./tools/definitions";
import { executeAssistantTool } from "./tools/handlers";
import { handleCompanyFollowup } from "./handlers/company-followup";
import { handleEmailDecision } from "./handlers/email-decision";
import {
  handleRepeatRequest,
  handlePreviousMessageQuery,
} from "./handlers/conversation-helpers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(20)
    .optional(),
  isVoiceMessage: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured in .env" },
      { status: 503 }
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, history = [], isVoiceMessage = false } = parsed;
  console.log("[Assistant Chat API] Incoming Request Message:", { message, isVoiceMessage });

  try {
    // 1. Company association follow-up check
    const companyRes = await handleCompanyFollowup({ message, history });
    if (companyRes) return companyRes;

    // 2. Email review decision check (send / draft / cancel / rewrite)
    const emailDecisionRes = await handleEmailDecision({ message, history });
    if (emailDecisionRes) return emailDecisionRes;

    // 3. Repeat & rephrase check
    const repeatRes = await handleRepeatRequest({ message, history, isVoiceMessage });
    if (repeatRes) return repeatRes;

    // 4. Previous user message query check
    const prevMsgRes = handlePreviousMessageQuery({ message, history });
    if (prevMsgRes) return prevMsgRes;

    // 5. Single-pass completion with native tools and token-optimized history
    const recentHistory = history.slice(-6).map((h) => {
      if (h.role === "assistant" && h.content.length > 1000) {
        const lines = h.content.split("\n").filter(Boolean);
        const titleLine = lines[0] || "";
        return {
          role: h.role,
          content: `${titleLine} [...${lines.length - 1} detailed item lines truncated to save tokens]`,
        };
      }
      return h;
    });
    const messages = buildMainSystemPrompt(recentHistory, isVoiceMessage, message, session.user);

    const completion = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages,
      tools: ASSISTANT_TOOLS,
      temperature: 0.3,
      max_tokens: 2048,
    });

    const choice = completion.choices?.[0]?.message;

    // Check if AI requested a tool call (e.g. create_task, get_tasks, draft_email)
    if (choice?.tool_calls?.length) {
      const toolCall = choice.tool_calls[0];
      const toolName = toolCall.function?.name;
      let args: any = {};
      try {
        args =
          typeof toolCall.function?.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function?.arguments || {};
      } catch (e) {}

      if (toolName) {
        const toolResponse = await executeAssistantTool(toolName, args, {
          sessionUser: session.user,
        });
        if (toolResponse) {
          return toolResponse;
        }
      }
    }

    const rawReply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate a response. Please try again.";
      
    const { reply, speakSummary } = extractSpeakSummary(rawReply);
    const speakReply = speakSummary
      ? speakSummary  // Use AI-generated spoken summary
      : formatSpeakReply(reply); // Fallback: strip markdown from full reply

    if (completion?.usage) {
      console.log(
        `[Assistant Chat API Token Total] Prompt: ${completion.usage.prompt_tokens} | Output: ${completion.usage.completion_tokens} | Total: ${completion.usage.total_tokens}`
      );
    }

    return NextResponse.json({
      reply,
      speakReply,
      usage: completion?.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    });
  } catch (error) {
    console.error("[api/assistant/chat]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Assistant request failed",
      },
      { status: 500 }
    );
  }
}
