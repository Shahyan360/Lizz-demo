import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth/options";
import { getGeminiAudioModel, isGeminiKey } from "../../../../config/gemini";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiKey()) {
    return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No audio file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "audio/webm";

    const model = getGeminiAudioModel();
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType.includes("webm") ? "audio/webm" : mimeType.includes("mp4") ? "audio/mp4" : "audio/webm",
          data: base64Audio,
        },
      },
      "Transcribe the spoken audio. If the audio in any language , or any non-English language, translate it accurately into natural English. If it is already in English, keep it in English. Output ONLY the translated text string without any quotes or explanations.",
    ]);

    const translatedText = result.response.text().trim();
    return NextResponse.json({ translatedText: translatedText || "" });
  } catch (error: any) {
    console.error("[api/assistant/transcribe] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to transcribe audio" }, { status: 500 });
  }
}
