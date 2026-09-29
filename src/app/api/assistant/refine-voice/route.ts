import { NextRequest, NextResponse } from "next/server";
import {
    geminiChatWithRetry,
    getGeminiModel,
    isGeminiKey
} from "../../../../config/gemini";
export async function POST(request: NextRequest) {
    try {

        if (!isGeminiKey()) {
            return NextResponse.json(
                { error: "Gemini key missing" },
                { status: 503 }
            );
        }

        const body = await request.json();

        const text = body.text;

        if (!text || typeof text !== "string") {
            return NextResponse.json({
                translatedText: ""
            });
        }


        const prompt = `
You are a voice input correction assistant for an AI CRM workspace.

Your job is to clean speech recognition output before sending it to the AI assistant.

Rules:
- Correct spelling mistakes.
- Fix speech recognition errors.
- Fix CRM words like contacts, meetings, tasks, emails.
- Fix employee names if they are slightly wrong.
- Keep the user's original meaning exactly the same.
- Do not add extra information.
- Do not summarize.
- Do not make the sentence formal.
- Keep it natural like the user spoke it.
- Return ONLY the corrected sentence.

Input:
${text}
`;

        const completion = await geminiChatWithRetry({
            model: getGeminiModel(),
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.1,
            max_tokens: 200,
        });


        const correctedText =
            completion.choices?.[0]?.message?.content?.trim() || text;

        return NextResponse.json({
            translatedText: correctedText || text
        });


    } catch (error) {

        console.error(
            "[refine-voice]",
            error
        );

        return NextResponse.json(
            {
                translatedText: ""
            },
            {
                status: 500
            }
        );
    }
}