import { NextResponse } from "next/server";
import { geminiChatWithRetry, getGeminiModel } from "../../../../../config/gemini";
import { formatSpeakReply } from "../utils";
import { buildRephrasePrompt } from "../prompts";

export async function handleRepeatRequest({
  message,
  history,
  isVoiceMessage,
}: {
  message: string;
  history: Array<{ role: string; content: string }>;
  isVoiceMessage: boolean;
}): Promise<NextResponse | null> {
  const normalizedMsg = message.trim().toLowerCase();
  // NOTE: bare "repeat"/"rephrase" are intentionally NOT included as standalone
  // substring triggers below — they would hijack unrelated requests that merely
  // mention the word (e.g. "create a task to repeat the weekly report").
  const isRepeatRequest =
    /^(repeat(\s*(yourself|that|them|it|your\s*last\s*(message|reply|response)))?|say\s*(that|it)?\s*again|pardon|could\s*you\s*repeat(\s*that|\s*them)?|can\s*you\s*repeat(\s*that|\s*them)?|what\s*did\s*you\s*say|rephrase(\s*that|\s*them)?)$/i.test(
      normalizedMsg
    ) ||
    /\b(repeat yourself|repeat that|repeat them|repeat it|say that again|say it again|repeat your last|rephrase that|rephrase them|i said repeat|i want you to repeat)\b/i.test(
      normalizedMsg
    );

  if (!isRepeatRequest) return null;

  const prevAssistantMsg = [...history]
    .reverse()
    .find(
      (h) =>
        h.role === "assistant" &&
        !h.content.toLowerCase().includes("handsfree voice active")
    );

  if (prevAssistantMsg) {
    const rephrasePrompt = buildRephrasePrompt(prevAssistantMsg.content, isVoiceMessage);

    const completion = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages: [{ role: "user", content: rephrasePrompt }],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || prevAssistantMsg.content;

    const speakReply = formatSpeakReply(reply);
    return NextResponse.json({ reply, speakReply });
  } else {
    const reply = "I haven't said anything yet to repeat! What can I help you with?";
    const speakReply = "I haven't said anything yet to repeat. What can I help you with?";
    return NextResponse.json({ reply, speakReply });
  }
}

export function handlePreviousMessageQuery({
  message,
  history,
}: {
  message: string;
  history: Array<{ role: string; content: string }>;
}): NextResponse | null {
  const normalizedMsg = message.trim().toLowerCase();
  const isPrevMsgQuery =
    /\b(what (was|is) my (previous|last) (message|question|prompt)|what did i (say|ask)|what was i asking|was my previous message)\b/i.test(
      normalizedMsg
    );

  if (!isPrevMsgQuery) return null;

  const prevUserMsg = [...history].reverse().find((h) => h.role === "user");

  if (prevUserMsg) {
    const reply = `Your previous message was: "${prevUserMsg.content}"`;
    const speakReply = formatSpeakReply(reply);
    return NextResponse.json({ reply, speakReply });
  } else {
    const reply = "You haven't sent a previous message yet in this conversation.";
    const speakReply = "You haven't sent a previous message yet in this conversation.";
    return NextResponse.json({ reply, speakReply });
  }
}
