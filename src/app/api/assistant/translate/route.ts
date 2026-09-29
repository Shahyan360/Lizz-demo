import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
    let text = "";

    try {
        const body = await request.json();
        text = body.text;

        if (!text || typeof text !== "string") {
            return NextResponse.json({ translatedText: "" });
        }

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);
        const data = await response.json();

        const translatedText = data?.[0]?.[0]?.[0] || text;

        return NextResponse.json({ translatedText });

    } catch (error) {
        console.error("Free Translation Error:", error);

        return NextResponse.json({
            translatedText: text
        });
    }
}