import type {
  Deal,
  Meeting,
  StoredEmail,
  Task,
} from "@prisma/client";
import { prisma } from "../prisma";
import { ZohoService } from "../../services/zoho.service";
import { buildZohoEmailUrl } from "../zoho/email-link";

export type ContactTimelineKind =
  | "email-in"
  | "email-out"
  | "task"
  | "meeting"
  | "deal";

export interface ContactTimelineItem {
  id: string;
  kind: ContactTimelineKind;
  date: string;
  title: string;
  snippet?: string;
  tag: string;
  bodyText?: string;
  zohoUrl?: string;
  href?: string;
  meta?: string;
  stage?: string;
  value?: number;
}

export interface ContactTimelineData {
  items: ContactTimelineItem[];
  stats: {
    emails: number;
    tasks: number;
    meetings: number;
    deals: number;
    openTasks: number;
  };
}

function preview(text: string, max = 200): string {
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

function niceEnum(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

async function loadContactEmails(
  contactId: string,
  contactEmail: string
): Promise<StoredEmail[]> {
  const rows = await prisma.storedEmail.findMany({
    where: {
      OR: [
        { contactId },
        { fromAddress: contactEmail },
        { toAddress: contactEmail },
      ],
    },
    orderBy: { receivedAt: "desc" },
    take: 150,
  });
  return rows;
}

function emailItems(
  emails: StoredEmail[],
  zohoUrls: Map<string, string>
): ContactTimelineItem[] {
  return emails.map((e) => {
    const isOut = e.direction === "OUTBOUND";
    const body = e.bodyHtml ? preview(e.bodyHtml) : preview(e.bodyText || "");
    const msgId = e.messageId?.trim();
    const zohoUrl = msgId ? zohoUrls.get(msgId) : undefined;

    return {
      id: `email-${e.id}`,
      kind: isOut ? "email-out" : "email-in",
      date: e.receivedAt.toISOString(),
      title: e.subject || "(No subject)",
      snippet: body,
      tag: isOut ? "Sent email" : "Received email",
      bodyText: e.bodyText || undefined,
      zohoUrl,
      meta: isOut ? `To: ${e.toAddress}` : `From: ${e.fromAddress}`,
    };
  });
}

function taskItems(tasks: Task[]): ContactTimelineItem[] {
  return tasks.map((t) => ({
    id: `task-${t.id}`,
    kind: "task",
    date: t.createdAt.toISOString(),
    title: t.title,
    snippet: t.description ? preview(t.description, 120) : undefined,
    tag: `Task · ${niceEnum(t.status)}`,
    meta: t.dueDate ? `Due ${t.dueDate.toLocaleDateString()}` : undefined,
    href: "/planner",
  }));
}

function meetingItems(meetings: Meeting[]): ContactTimelineItem[] {
  return meetings.map((m) => ({
    id: `meeting-${m.id}`,
    kind: "meeting",
    date: m.startTime.toISOString(),
    title: m.title,
    snippet: m.description ? preview(m.description, 120) : undefined,
    tag: `Meeting · ${niceEnum(m.status)}`,
    meta: m.location ? `Location: ${m.location}` : undefined,
    href: "/planner",
  }));
}

function dealItems(deals: Deal[]): ContactTimelineItem[] {
  return deals.map((d) => ({
    id: `deal-${d.id}`,
    kind: "deal",
    date: d.updatedAt.toISOString(),
    title: d.title,
    snippet: d.notes ? preview(d.notes, 120) : undefined,
    tag: `Deal · ${d.stage}`,
    stage: d.stage,
    value: d.value ?? undefined,
    meta: d.value != null ? `$${Math.round(d.value).toLocaleString()}` : undefined,
    href: "/deals",
  }));
}

export async function getContactTimeline(
  contact: { id: string; email: string }
): Promise<ContactTimelineData> {
  const [emails, tasks, meetings, deals] = await Promise.all([
    loadContactEmails(contact.id, contact.email),
    prisma.task.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.meeting.findMany({
      where: { contactId: contact.id },
      orderBy: { startTime: "desc" },
    }),
    prisma.deal.findMany({
      where: { contactId: contact.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const zohoByMessageId = new Map<string, string>();
  const messageIds = emails
    .map((e) => e.messageId?.trim())
    .filter((id): id is string => Boolean(id));

  if (messageIds.length > 0) {
    try {
      const accountId = await ZohoService.getAccountId();
      const inboxFolderId = await ZohoService.getFolderIdByName("Inbox", accountId);
      for (const email of emails) {
        const messageId = email.messageId?.trim();
        if (!messageId) continue;
        zohoByMessageId.set(
          messageId,
          buildZohoEmailUrl({
            accountId,
            folderId: email.folderId ?? inboxFolderId ?? accountId,
            folderSlug: "inbox",
            messageId,
            threadId: email.threadId ?? undefined,
          })
        );
      }
    } catch (err) {
      console.warn(
        "[contact-timeline] Zoho link build skipped:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const items = [
    ...emailItems(emails, zohoByMessageId),
    ...taskItems(tasks),
    ...meetingItems(meetings),
    ...dealItems(deals),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const openTasks = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CANCELLED"
  ).length;

  return {
    items,
    stats: {
      emails: emails.length,
      tasks: tasks.length,
      meetings: meetings.length,
      deals: deals.length,
      openTasks,
    },
  };
}
