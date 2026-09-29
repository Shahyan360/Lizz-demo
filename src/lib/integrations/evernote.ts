import { ZohoService } from "../../services/zoho.service";
import { EVERNOTE_FORWARD } from "../reply/business-knowledge";

/** Default Evernote email-in routing for proposal follow-ups (no .env required). */
const EVERNOTE_TASK_NOTEBOOK = "Tasks";
const EVERNOTE_TASK_TAG = "createtask";

/**
 * Evernote email-in commands (see Evernote Help: Save emails into Evernote).
 * Order: title, !reminder (today), @notebook, #tag.
 *
 * Reminder is always included by default so the note appears in Evernote's
 * reminders / task workflow. Inbound mail still becomes a note (Evernote has no
 * email-to-Task API).
 */
export function buildEvernoteTaskInboxSubject(baseTitle: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return [
    baseTitle.trim(),
    `!${yyyy}/${mm}/${dd}`,
    `@${EVERNOTE_TASK_NOTEBOOK}`,
    `#${EVERNOTE_TASK_TAG}`,
  ].join(" ");
}

function plainTextToEvernoteHtml(text: string): string {
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

/** Sends proposal / follow-up details to Evernote via email-in (task inbox routing). */
export async function sendProposalDetailsToEvernote(input: {
  title: string;
  body: string;
}): Promise<void> {
  const subject = buildEvernoteTaskInboxSubject(input.title);
  const content = plainTextToEvernoteHtml(input.body);

  await ZohoService.sendEmail({
    toAddress: EVERNOTE_FORWARD.address,
    subject,
    content,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
