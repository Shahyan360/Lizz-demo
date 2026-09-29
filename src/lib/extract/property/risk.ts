import { addFollowUp } from "../../repositories/property.repository";
import { getPrimaryTeamMemberForRole } from "../../reply/team-roster";
import { upsertEmailTask } from "../../tools";
import type { ExistingProperty } from "./lookup";
import type { ExtractedProperty, InboundEmailMeta } from "./schema";

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").toLowerCase();
}

/**
 * Diffs a fresh extraction against the property already on file for signals
 * that AutoGate has historically missed until it was too late: a management
 * company or point-of-contact quietly changing, or the property explicitly
 * saying it's shopping the project around. Each returned string is a
 * human-readable reason a rep can act on — empty when nothing looks off.
 */
export function detectPropertyRisk(
  existing: ExistingProperty,
  extracted: ExtractedProperty
): string[] {
  const reasons: string[] = [];

  const existingMgmt = existing.managementCompany?.trim().toLowerCase();
  const newMgmt = extracted.managementCompany?.trim().toLowerCase();
  if (existingMgmt && newMgmt && existingMgmt !== newMgmt) {
    reasons.push(
      `Management company on file is "${existing.managementCompany}" but this ` +
        `email identifies "${extracted.managementCompany}" — possible management change.`
    );
  }

  for (const c of extracted.contacts) {
    const newName = c.name?.trim();
    if (!newName) continue;
    const sameRoleContacts = existing.contacts.filter(
      (ec) => ec.role === c.role && ec.name?.trim()
    );
    if (sameRoleContacts.length === 0) continue;
    const matchesSomeone = sameRoleContacts.some(
      (ec) => ec.name!.trim().toLowerCase() === newName.toLowerCase()
    );
    if (!matchesSomeone) {
      reasons.push(
        `New ${roleLabel(c.role)} "${newName}" doesn't match the name(s) on file ` +
          `(${sameRoleContacts.map((ec) => ec.name).join(", ")}) — possible staffing change.`
      );
    }
  }

  if (extracted.competitiveRisk !== "NONE") {
    const label =
      extracted.competitiveRisk === "GOING_OUT_TO_BID"
        ? "going out to bid"
        : "evaluating other vendors";
    reasons.push(
      `Email signals the property is ${label}` +
        (extracted.competitiveRiskDetail ? `: "${extracted.competitiveRiskDetail}"` : ".")
    );
  }

  return reasons;
}

/**
 * Surfaces a detected risk as a HIGH-priority task (so it lands on a real
 * teammate's queue, not just a buried DB field) plus a FollowUp log entry —
 * this is the concrete fix for AutoGate losing properties to a competing bid
 * because nobody was told management or plans had changed.
 */
export async function raisePropertyRiskAlert(
  existing: ExistingProperty,
  reasons: string[],
  input: InboundEmailMeta
): Promise<void> {
  const ownerReviewer = await getPrimaryTeamMemberForRole("owner_review");

  const description = [
    `Property: ${existing.name}` +
      (existing.managementCompany ? ` (managed by ${existing.managementCompany})` : ""),
    "",
    "Auto-flagged from an inbound email — review before this opportunity is lost to a competing bid:",
    ...reasons.map((r) => `- ${r}`),
  ].join("\n");

  const { task } = await upsertEmailTask({
    assignee: ownerReviewer?.name,
    title: `⚠️ Review needed — ${existing.name}`,
    description,
    priority: "HIGH",
    sourceFrom: `${input.senderName} <${input.fromAddress}>`.trim(),
    sourceSubject: input.subject,
  });
  console.log(`[property-extraction] risk alert task created/updated: "${task.title}"`);

  if (existing.opportunity) {
    await addFollowUp(existing.opportunity.id, {
      contactedBy: "Lizzz (auto-extraction)",
      contactMethod: "EMAIL",
      notes: `🚨 Auto-flagged risk: ${reasons.join(" ")}`,
    });
  }
}
