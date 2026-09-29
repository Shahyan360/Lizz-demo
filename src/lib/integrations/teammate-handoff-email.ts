import { ZohoService } from "../../services/zoho.service";
import { emailForRouteTo } from "../reply/business-knowledge";
import { getTeamRoster } from "../reply/team-roster";

const ROUTE_TO_LINE = /^Route To:\s*(.+)$/m;

/** Reads `Route To: …` from an Evernote / handoff body. */
export function parseRouteToFromHandoffBody(body: string): string | null {
  const match = body.match(ROUTE_TO_LINE);
  return match?.[1]?.trim() ?? null;
}

function plainTextToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const urlMatch = line.match(/^(Zoho Email: )(https:\/\/.+)$/);
      if (urlMatch) {
        return `<p>${urlMatch[1]}<a href="${urlMatch[2]}">${urlMatch[2]}</a></p>`;
      }
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Sends the same handoff details Evernote received to the routed teammate's inbox. */
export async function sendHandoffDetailsToTeammate(input: {
  routeTo: string;
  customerSubject: string;
  body: string;
}): Promise<string | null> {
  const target = input.routeTo.trim().toLowerCase();
  const liveMember = (await getTeamRoster()).find(
    (member) =>
      member.name.trim().toLowerCase() === target ||
      member.name.trim().split(/\s+/)[0]?.toLowerCase() === target
  );
  const toAddress = liveMember?.email ?? emailForRouteTo(input.routeTo);
  if (!toAddress) {
    console.warn(
      `[teammate-handoff] No roster email for routeTo "${input.routeTo}"`
    );
    return null;
  }

  const subject = `[Handoff — ${input.routeTo}] Re: ${input.customerSubject}`.trim();
  const content = plainTextToHtml(input.body);

  await ZohoService.sendEmail({
    toAddress,
    subject,
    content,
  });

  return toAddress;
}

/** Emails the assignee that a planner task was assigned to them. */
export async function sendTaskAssigneeNotify(input: {
  assignee: string;
  taskTitle: string;
  description?: string | null;
  priority?: string | null;
  dueDateLabel?: string | null;
  contactLabel?: string | null;
  sourceSubject?: string | null;
  actorName?: string | null;
}): Promise<string | null> {
  const toAddress = emailForRouteTo(input.assignee);
  if (!toAddress) {
    console.warn(
      `[teammate-handoff] No roster email for assignee "${input.assignee}"`
    );
    return null;
  }

  const lines = [
    `Hi ${input.assignee},`,
    "",
    input.actorName
      ? `${input.actorName} assigned you a task in Lizzz:`
      : "You have been assigned a task in Lizzz:",
    "",
    `Task: ${input.taskTitle}`,
  ];
  if (input.priority) lines.push(`Priority: ${input.priority}`);
  if (input.dueDateLabel) lines.push(`Due: ${input.dueDateLabel}`);
  if (input.contactLabel) lines.push(`Contact: ${input.contactLabel}`);
  if (input.sourceSubject) lines.push(`Source email: ${input.sourceSubject}`);
  if (input.description?.trim()) {
    lines.push("", "Details:", input.description.trim());
  }
  lines.push("", "— Lizzz");

  await ZohoService.sendEmail({
    toAddress,
    subject: `[Task assigned] ${input.taskTitle}`.slice(0, 200),
    content: plainTextToHtml(lines.join("\n")),
  });

  return toAddress;
}
