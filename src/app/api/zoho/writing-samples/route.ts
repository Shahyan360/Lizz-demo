import { NextResponse } from "next/server";
import { getWritingSamples } from "../../../../lib/reply/writing-samples";

export const dynamic = "force-dynamic";

/**
 * GET /api/zoho/writing-samples — returns the recent Sent-email samples that
 * are fed to the LLM as writing-style examples. TEMPORARY / for inspection.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const samples = await getWritingSamples(5);
    return NextResponse.json({ count: samples.length, samples });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
