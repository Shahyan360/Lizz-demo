import { NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";

/**
 * Diagnostic: creates a FRESH Zoho task, captures its exact id, then immediately
 * updates that task's description. Confirms end-to-end whether task-update sync
 * works on a task created AFTER the id-precision fix — without running the email
 * flow. Creates a real task in your Zoho group (marked, safe to delete).
 *
 *   GET /api/zoho/task-sync-test
 *
 * Read the result:
 *   createdTaskId  — the exact id Zoho returned (should be full 18–19 digits)
 *   updateOk:true  — the update call succeeded → open Zoho and check the task's
 *                    description now reads the UPDATED text ⇒ sync works.
 *   updateOk:false — updateError holds Zoho's exact message ⇒ the endpoint is
 *                    still wrong; paste it back and we fix the endpoint.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const stamp = `${new Date().toISOString()}`;
  const title = `🔧 Sync test — safe to delete (${stamp})`;

  let createdTaskId: string | null = null;
  let createError: string | null = null;
  try {
    createdTaskId = await ZohoService.createTask({
      title,
      description: "INITIAL description (before update).",
      priority: "low",
    });
  } catch (err) {
    createError = err instanceof Error ? err.message : String(err);
  }

  let updateOk = false;
  let updateError: string | null = null;
  if (createdTaskId) {
    try {
      await ZohoService.updateTask(createdTaskId, {
        description:
          "UPDATED description — if you see THIS in Zoho, task-update sync works. ✅",
      });
      updateOk = true;
    } catch (err) {
      updateError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    createdTaskId,
    createdIdDigits: createdTaskId?.length ?? 0,
    createError,
    updateOk,
    updateError,
    conclusion: !createdTaskId
      ? "❌ Could not even CREATE a Zoho task — check createError (scope/endpoint)."
      : updateOk
        ? "✅ Created + updated. Open Zoho and confirm the task shows the UPDATED description."
        : "⚠️ Created but UPDATE failed — updateError has Zoho's exact message; the update endpoint needs fixing.",
    note: "This created a real task in your Zoho group — delete it when done.",
  });
}
