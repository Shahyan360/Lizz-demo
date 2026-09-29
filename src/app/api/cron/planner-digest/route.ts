import { NextRequest, NextResponse } from "next/server";
import { executePlannerDigest } from "../../../../lib/integrations/execute-planner-digest";

export const dynamic = "force-dynamic";

async function handlePlannerDigest(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await executePlannerDigest();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export const GET = handlePlannerDigest;
export const POST = handlePlannerDigest;
