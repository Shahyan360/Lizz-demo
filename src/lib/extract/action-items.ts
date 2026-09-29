import { z } from "zod";
import { getGeminiModel, geminiChatWithRetry } from "../../config/gemini";
import {
  upsertEmailTask,
  updateTask,
  createMeeting,
  upsertContact,
  setTaskStatus,
  upsertEmailDeal,
  loseOpenDeal,
} from "../tools";
import { prisma } from "../prisma";
import { stripQuotedText } from "../email/strip-quoted";
import { getTeamRoster, type Teammate } from "../reply/team-roster";
import { roleLabelForKey } from "../reply/team-routing";

/**
 * AI action-item extractor.
 *
 * Given an inbound email, asks Gemini to pull out any explicit TASKS (things the
 * recipient needs to do) and MEETINGS (scheduled calls / appointments), then
 * persists them to the `Task` / `Meeting` tables — linked to the sender's
 * `Contact` when we can resolve one. Returns empty arrays when the email holds
 * no action items, so most mail produces nothing.
 *
 * Like the classifier, this must NEVER throw into the webhook: callers wrap it.
 */

const MAX_BODY_CHARS = 4000;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function normalizePriority(value: unknown): (typeof PRIORITIES)[number] | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const v = value.trim().toUpperCase();
  if (!v) return undefined;
  if (/URGENT|CRITICAL|ASAP|EMERGENCY|IMMEDIATE/.test(v)) return "URGENT";
  if (/HIGH/.test(v)) return "HIGH";
  if (/LOW/.test(v)) return "LOW";
  if (/MED|NORMAL|STANDARD|ROUTINE/.test(v)) return "MEDIUM";
  return undefined;
}

/** The JSON shape we force the model to return. */
const extractionSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().nullish(),
        priority: z.string().nullish(),
        dueDate: z.string().nullish(), // ISO date, or null if none stated
        assignee: z.string().nullish(),
      })
    )
    .default([]),
  meetings: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().nullish(),
        location: z.string().nullish(),
        startTime: z.string().nullish(), // ISO datetime, or null if none stated
        endTime: z.string().nullish(),
        attendees: z.array(z.string()).nullish(),
      })
    )
    .default([]),
  // Numbers (1-based) of the OPEN TASKS this email confirms are now completed.
  completedTaskNumbers: z.array(z.number()).default([]),
  cancelledTasks: z
    .array(
      z.object({
        number: z.number(),
        reason: z.string().nullish(),
      })
    )
    .default([]),
  taskUpdates: z
    .array(
      z.object({
        number: z.number(),
        description: z.string().min(1),
        priority: z.string().nullish(),
      })
    )
    .default([]),
  // A sales opportunity, if this email represents one.
  deal: z
    .object({
      isOpportunity: z.boolean().default(false),
      title: z.string().nullish(),
      stage: z.enum(["NEW", "QUOTED"]).nullish(),
      value: z.number().nullish(),
      // The customer has DECLINED / won't proceed — mark our open deal LOST.
      lost: z.boolean().default(false),
    })
    .nullish(),
  // Key contact / property details extracted from the email body.
  // These are prepended to every task description so the assigned team member
  // has everything they need without reading the full email thread.
  contactInfo: z
    .object({
      name: z.string().nullish(),           // customer full name (if different from email sender)
      phone: z.string().nullish(),          // any phone / mobile number mentioned
      alternateEmail: z.string().nullish(), // secondary email if stated
      propertyAddress: z.string().nullish(),// full property / job-site address
      city: z.string().nullish(),
      state: z.string().nullish(),
      propertyType: z.string().nullish(),   // e.g. "residential", "commercial", "apartment"
      notes: z.string().nullish(),          // any other key detail (e.g. gate model, HOA, access code)
    })
    .nullish(),
});

export type ExtractedActionItems = z.infer<typeof extractionSchema>;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatContactInfoBlock(
  senderName: string,
  fromAddress: string,
  info: NonNullable<ExtractedActionItems["contactInfo"]>
): string {
  const lines: string[] = ["📋 Customer Info"];

  const name = info.name?.trim() || senderName?.trim();
  if (name) lines.push(`Name: ${name}`);
  lines.push(`Email: ${fromAddress}`);
  if (info.phone?.trim()) lines.push(`Phone: ${info.phone.trim()}`);
  if (info.alternateEmail?.trim()) lines.push(`Alt Email: ${info.alternateEmail.trim()}`);

  const addressParts = [
    info.propertyAddress?.trim(),
    info.city?.trim(),
    info.state?.trim(),
  ].filter(Boolean);
  if (addressParts.length > 0) lines.push(`Address: ${addressParts.join(", ")}`);

  if (info.propertyType?.trim()) lines.push(`Property Type: ${info.propertyType.trim()}`);
  if (info.notes?.trim()) lines.push(`Notes: ${info.notes.trim()}`);

  return lines.length > 1 ? lines.join("\n") + "\n\n" : "";
}

function buildRosterAssignmentBlock(roster: Teammate[]): string {
  if (roster.length === 0) {
    return "No active team roster is configured — set task.assignee to null.";
  }
  const lines = roster.map(
    (m) => `  * '${m.name}' (${roleLabelForKey(m.roleKey)})`
  );
  return (
    "task.assignee MUST be the EXACT name of one active team member below, " +
    "chosen by matching the work to their role — or null if truly no one fits:\n" +
    lines.join("\n") +
    "\n  CRITICAL: If the email is addressed to or mentions one of these people by " +
    "name (e.g. 'Hi Dave'), task.assignee MUST be that exact name.\n" +
    "  As a general guide: sales proposals/quotes/estimating/new installs go to " +
    "a Proposal Review or Owner Review role; repairs/technical " +
    "service/troubleshooting/safety compliance go to a repair/technical or Owner " +
    "Review role; scheduling/site-visit booking goes to the Scheduling role; " +
    "billing/tax/CRM/admin paperwork goes to the Admin / CRM role. If unsure, " +
    "pick the roster member whose role is the closest overall match."
  );
}

function buildInternalOnlyPrompt(today: string): string {
  return (
    "You work for AutoGate Electric. This is one of OUR OWN internal/outbound " +
    "emails (not a new customer inquiry) — check it ONLY against the OPEN " +
    "TASKS listed below for status changes. Do NOT create new tasks, meetings, " +
    "deals, or contact info from this email — those fields are ignored for " +
    "internal mail.\n\n" +
    `Today's date is ${today}. Resolve relative dates (e.g. "tomorrow") to ` +
    "absolute ISO dates based on it.\n\n" +
    "- COMPLETED: if the email EXPLICITLY states the underlying problem is now " +
    "FIXED/WORKING/RESOLVED/DONE, put that task's NUMBER in " +
    "completedTaskNumbers. Be STRICT — a generic thank-you or acknowledgment " +
    "without a clear resolution statement is NOT a completion.\n" +
    "- CANCELLED: if the email shows the customer CALLED OFF or DECLINED the " +
    "work a task tracks, add it to cancelledTasks with that task's NUMBER and " +
    "a SHORT reason.\n" +
    "- UPDATED: if the email adds new information that changes what's needed " +
    "for an open task (a new sub-request tied to the same job, or a concrete " +
    "development), return it in taskUpdates with that task's NUMBER and a " +
    "REWRITTEN description reflecting the CURRENT state. Only update when the " +
    "email genuinely adds task-relevant info.\n" +
    "- When in doubt, or nothing applies, return everything empty — most " +
    "emails should produce no changes.\n\n" +
    'Respond ONLY as JSON: {"tasks": [], "meetings": [], "completedTaskNumbers": [<numbers>], ' +
    '"cancelledTasks": [{"number": <n>, "reason": <string>}], ' +
    '"taskUpdates": [{"number": <n>, "description": <string>, "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT"|null}], ' +
    '"deal": null, "contactInfo": null}.'
  );
}

/** Calls the LLM to extract tasks + meetings. Returns empty arrays on nothing. */
export async function extractActionItems(input: {
  senderName: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  /** This contact's still-open tasks, so the model can flag ones now completed
   *  or update one whose scope the email changed. */
  openTasks?: { id: string; title: string; description: string | null }[];
  /** Active team roster, for assignment — see buildRosterAssignmentBlock. */
  teamRoster?: Teammate[];
  /** Our own outbound mail / a teammate's own email — see buildInternalOnlyPrompt. */
  isInternal?: boolean;
}): Promise<ExtractedActionItems> {
  // Analyze only the sender's NEW message — strip any quoted reply history so we
  // never turn our own quoted questions back into "tasks".
  const body = stripQuotedText(input.bodyText).slice(0, MAX_BODY_CHARS);
  // Give the model "today" so it can resolve relative dates ("tomorrow", "Fri").
  const today = new Date().toISOString().slice(0, 10);

  if (input.isInternal) {
    const openTasks = input.openTasks ?? [];
    const openTasksBlock = openTasks.length
      ? `\n\nOPEN TASKS (ours, still to do for this customer):\n` +
        openTasks
          .map(
            (t, i) =>
              `[${i + 1}] ${t.title}` +
              (t.description ? `\n     current notes: ${t.description}` : "")
          )
          .join("\n")
      : "";
    const user =
      `FROM: ${input.senderName} <${input.fromAddress}>\n` +
      `SUBJECT: ${input.subject}\n\nBODY:\n${body}` +
      openTasksBlock;

    const response = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages: [
        { role: "system", content: buildInternalOnlyPrompt(today) },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 300,
    });

    return extractionSchema.parse(
      JSON.parse(response.choices[0].message.content || "{}")
    );
  }

  const rosterBlock = buildRosterAssignmentBlock(input.teamRoster ?? []);

  const system =
    "You work for AutoGate Electric. An inbound email from a CUSTOMER is below. " +
    "Extract only action items that WE (AutoGate Electric — the recipient) must " +
    "act on. Identify:\n" +
    "- TASKS: concrete things WE must do to serve this customer (send them a " +
    "quote, schedule/dispatch a technician, order a part, call them back, prepare " +
    "a document, etc.).\n" +
    "- MEETINGS: scheduled calls, site visits, or appointments with a time.\n\n" +
    `Today's date is ${today}. Resolve relative dates (e.g. "tomorrow", ` +
    '"next Friday") to absolute ISO dates based on it.\n\n' +
    "CRITICAL rules:\n" +
    "- A task is ALWAYS something WE do. NEVER create a task for something we are " +
    "asking the customer to do (e.g. 'provide more information', 'confirm your " +
    "address', 'send photos'). Those are the customer's to-dos, not ours — skip " +
    "them entirely.\n" +
    "- JUDGE first: only create a task when the email contains a clear, concrete " +
    "request or problem that requires action from us. Greetings, thank-yous, " +
    "acknowledgements, confirmations, FYIs, or vague chit-chat with no actionable " +
    "request → return EMPTY arrays. Most emails should produce nothing. Do NOT " +
    "invent or pad items.\n" +
    "- Phrase each task as OUR action from our point of view (e.g. 'Diagnose the " +
    "customer's glitching auto door', 'Send Adnan a repair quote').\n" +
    "- task.priority must be one of: LOW, MEDIUM, HIGH, URGENT.\n" +
    `- ${rosterBlock}\n` +
    "- Use ISO 8601 for dates (task.dueDate = YYYY-MM-DD; meeting.startTime / " +
    "endTime = full datetime). Use null when no date/time is stated.\n" +
    "- A meeting without any resolvable date/time will be dropped, so only list a " +
    "meeting when a time is present.\n" +
    "- CONTACT INFO: Always populate the \"contactInfo\" object with any information " +
    "about the customer found anywhere in the email:\n" +
    "  * name: customer full name (if stated separately from the email sender name, e.g. signing off as a different person).\n" +
    "  * phone: any phone or mobile number mentioned (e.g. '(703) 555-1234', '+1-800-AUTOGATE').\n" +
    "  * alternateEmail: any secondary email address mentioned.\n" +
    "  * propertyAddress: full street address of the property or job site.\n" +
    "  * city: city of the property or customer.\n" +
    "  * state: state / region.\n" +
    "  * propertyType: e.g. 'residential', 'commercial', 'apartment', 'condo', 'HOA'.\n" +
    "  * notes: any other detail relevant to the job (gate model, HOA restrictions, " +
    "access code, preferred contact time, specific requirements, etc.).\n" +
    "  Set each field to null if not mentioned. contactInfo is ALWAYS returned (even " +
    "when no tasks/meetings are found) as long as any field has a value.\n" +
    "- COMPLETED TASKS: if OPEN TASKS are listed below and the email EXPLICITLY " +
    "states the underlying problem is now FIXED / WORKING / RESOLVED / DONE (e.g. " +
    "\"the gate is working now\", \"it's fixed\", \"issue resolved\", \"the tech " +
    "came and sorted it\"), put that task's NUMBER in completedTaskNumbers. Be " +
    "STRICT: a generic thank-you, \"appreciate it\", \"thanks for looking into " +
    "it\", or any acknowledgment WITHOUT a clear statement that the problem is " +
    "resolved is NOT a completion — do NOT mark anything done in that case. Match " +
    "only the specific task the email actually resolves; when in any doubt, leave " +
    "it out. An email can complete a task AND contain no new tasks.\n" +
    "- CANCELLED / DECLINED TASKS: if OPEN TASKS are listed and this email shows " +
    "the customer has CALLED OFF or DECLINED the work a task tracks — they no " +
    "longer want it, it's too expensive, they've changed their mind, chosen " +
    "another vendor, or asked to cancel (e.g. \"I don't want to install the " +
    "cameras, the price is too high\", \"we've decided not to go ahead\", \"please " +
    "cancel my request\") — add it to cancelledTasks with that task's NUMBER and a " +
    "SHORT reason (e.g. \"customer declined — price too high\", \"chose another " +
    "vendor\"). This is NOT completion (the work was never done) — the customer " +
    "opted out. Match only the task the email actually calls off; do NOT cancel " +
    "for a mere delay or a question about price.\n" +
    "- UPDATING AN OPEN TASK: if OPEN TASKS are listed and this email adds new " +
    "information that changes what we must do for one of them — a new sub-request " +
    "tied to that same job (e.g. the customer now ALSO wants the name of the " +
    "technician who'll attend), or a concrete development (e.g. a specific person " +
    "is now confirmed to be on site) — return it in taskUpdates with that task's " +
    "NUMBER and a REWRITTEN description reflecting the CURRENT state of what's " +
    "needed (keep the still-relevant detail and fold in the new bit). PREFER " +
    "updating the related open task over creating a near-duplicate new task. Only " +
    "update when the email genuinely adds task-relevant info — never for a " +
    "greeting or chit-chat — and do NOT put the same item in both tasks and " +
    "taskUpdates.\n" +
    "- DEAL / SALES OPPORTUNITY: if this email is a SALES opportunity — a new " +
    "inquiry to buy or install, a quote/estimate request, or a project they want " +
    "done — set deal.isOpportunity=true with a SHORT deal title (e.g. \"4m " +
    "sliding gate install\", \"Gate opener replacement\"). deal.stage = \"QUOTED\" " +
    "only if a quote/estimate is clearly being sent or discussed, otherwise " +
    "\"NEW\". deal.value = the dollar amount ONLY if clearly stated, else null. " +
    "For support, complaints, scheduling, or general mail that is NOT a sales " +
    "opportunity, set deal.isOpportunity=false. Set deal.lost=true ONLY when this " +
    "email DECLINES or cancels an opportunity we were pursuing (won't proceed, " +
    "price too high, chose another vendor) — that marks our open deal LOST.\n\n" +
    'Respond ONLY as JSON: {"tasks": [{"title","description","priority","dueDate","assignee"}], ' +
    '"meetings": [{"title","description","location","startTime","endTime","attendees"}], ' +
    '"completedTaskNumbers": [<numbers>], ' +
    '"cancelledTasks": [{"number": <n>, "reason": <string>}], ' +
    '"taskUpdates": [{"number": <n>, "description": <string>, "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT"|null}], ' +
    '"deal": {"isOpportunity": <bool>, "title": <string|null>, "stage": "NEW"|"QUOTED"|null, "value": <number|null>, "lost": <bool>}, ' +
    '"contactInfo": {"name": <string|null>, "phone": <string|null>, "alternateEmail": <string|null>, ' +
    '"propertyAddress": <string|null>, "city": <string|null>, "state": <string|null>, ' +
    '"propertyType": <string|null>, "notes": <string|null>}}.';


  const openTasks = input.openTasks ?? [];
  const openTasksBlock = openTasks.length
    ? `\n\nOPEN TASKS (ours, still to do for this customer):\n` +
      openTasks
        .map(
          (t, i) =>
            `[${i + 1}] ${t.title}` +
            (t.description ? `\n     current notes: ${t.description}` : "")
        )
        .join("\n")
    : "";

  const user =
    `FROM: ${input.senderName} <${input.fromAddress}>\n` +
    `SUBJECT: ${input.subject}\n\nBODY:\n${body}` +
    openTasksBlock;

  const response = await geminiChatWithRetry({
    model: getGeminiModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2048,
  });

  const rawContent = response.choices[0]?.message?.content?.trim() || "{}";
  try {
    return extractionSchema.parse(JSON.parse(rawContent));
  } catch (err) {
    console.warn("[action-items] Failed to parse model output as JSON:", rawContent.slice(0, 100));
    return extractionSchema.parse({});
  }
}

/**
 * Validates the model's chosen assignee against the LIVE active roster
 * (case-insensitive exact match) and falls back to the primary/first active
 * member rather than trusting an invented or stale name — a task assigned
 * to someone who isn't on the roster would silently never show up on any
 * real teammate's queue.
 */
function resolveAssignee(
  name: string | null | undefined,
  roster: Teammate[]
): string | undefined {
  const trimmed = name?.trim();
  if (trimmed) {
    const match = roster.find(
      (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (match) return match.name;
  }
  return roster.find((m) => m.isPrimary)?.name ?? roster[0]?.name;
}

/**
 * Finds or creates the sender's Contact (for linking), bumping its interaction
 * counter. Returns null if the sender address is missing.
 */
async function upsertSenderContact(
  fromAddress: string,
  senderName: string
): Promise<string | null> {
  const email = fromAddress.trim().toLowerCase();
  if (!email) return null;
  const contact = await upsertContact({ email, name: senderName || null });
  return contact.id;
}

export async function extractAndSaveActionItems(input: {
  senderName: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  isInternal?: boolean;
}): Promise<{
  taskCount: number;
  updatedTaskCount: number;
  completedTaskCount: number;
  cancelledTaskCount: number;
  dealCount: number;
  meetingCount: number;
  skippedMeetings: number;
}> {
  const contactId = await upsertSenderContact(
    input.fromAddress,
    input.senderName
  );

  const cleanSubject = input.subject.replace(/^Re:\s*/i, "").trim();

  // Find still-open tasks for this contact or matching subject, so the extractor can flag
  // ones the email (customer or internal team reply) confirms are now done.
  const openTasks = await prisma.task.findMany({
    where: {
      status: { in: ["TODO", "IN_PROGRESS"] },
      ...(contactId || cleanSubject
        ? {
            OR: [
              ...(contactId ? [{ contactId }] : []),
              ...(cleanSubject
                ? [
                    {
                      sourceSubject: {
                        contains: cleanSubject,
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const teamRoster = await getTeamRoster();
  const extracted = await extractActionItems({ ...input, openTasks, teamRoster });

  const sourceBody = stripQuotedText(input.bodyText).slice(0, MAX_BODY_CHARS);

  let completedTaskCount = 0;
  for (const num of extracted.completedTaskNumbers) {
    const target = openTasks[num - 1];
    if (target) {
      await setTaskStatus(target.id, "DONE");
      console.log(`     ✅ completed task: "${target.title}"`);
      completedTaskCount += 1;
    }
  }

  let cancelledTaskCount = 0;
  for (const c of extracted.cancelledTasks) {
    const target = openTasks[c.number - 1];
    if (!target || extracted.completedTaskNumbers.includes(c.number)) continue;
    const reason = (c.reason ?? "").trim();
    const note = reason ? `❌ Cancelled — ${reason}` : "❌ Cancelled by the customer.";
    const description = target.description ? `${target.description}\n\n${note}` : note;
    await updateTask(target.id, { status: "CANCELLED", description });
    console.log(`     ❌ cancelled task: "${target.title}"${reason ? ` — ${reason}` : ""}`);
    cancelledTaskCount += 1;
  }

  let updatedTaskCount = 0;
  for (const upd of extracted.taskUpdates) {
    const target = openTasks[upd.number - 1];
    if (!target) continue;
    const priority = normalizePriority(upd.priority);
    await updateTask(target.id, {
      description: upd.description,
      ...(priority ? { priority } : {}),
    });
    console.log(`     📝 updated task: "${target.title}" → ${upd.description}`);
    updatedTaskCount += 1;
  }

  let dealCount = 0;
  const deal = extracted.deal;
  if (deal?.lost && contactId) {
    await loseOpenDeal(contactId);
  } else if (deal?.isOpportunity && deal.title && contactId) {
    const { created } = await upsertEmailDeal({
      contactId,
      title: deal.title,
      stage: deal.stage ?? "NEW",
      value: deal.value ?? null,
      sourceFrom: `${input.senderName} <${input.fromAddress}>`.trim(),
      sourceSubject: input.subject,
      sourceBody,
    });
    if (created) dealCount = 1;
  }

  if (extracted.tasks.length === 0 && extracted.meetings.length === 0) {
    return {
      taskCount: 0,
      updatedTaskCount,
      completedTaskCount,
      cancelledTaskCount,
      dealCount,
      meetingCount: 0,
      skippedMeetings: 0,
    };
  }

  const contactInfoBlock = extracted.contactInfo
    ? formatContactInfoBlock(input.senderName, input.fromAddress, extracted.contactInfo)
    : "";

  let taskCount = 0;
  if (!input.isInternal) {
    for (const task of extracted.tasks) {
      const baseDescription = task.description?.trim() ?? null;
      const fullDescription = contactInfoBlock
        ? baseDescription
          ? `${contactInfoBlock}\n\n${baseDescription}`
          : contactInfoBlock
        : baseDescription;

      const { created } = await upsertEmailTask({
        contactId,
        assignee: resolveAssignee(task.assignee, teamRoster),
        title: task.title,
        description: fullDescription,
        priority: normalizePriority(task.priority) ?? undefined,
        dueDate: parseDate(task.dueDate),
        sourceFrom: `${input.senderName} <${input.fromAddress}>`.trim(),
        sourceSubject: input.subject,
        sourceBody,
      });
      if (created) {
        console.log(`     ➕ new task: "${task.title}"`);
        taskCount += 1;
      } else {
        console.log(`     📝 updated task (same title): "${task.title}"`);
        updatedTaskCount += 1;
      }
    }
  }

  let meetingCount = 0;
  let skippedMeetings = 0;
  if (!input.isInternal) {
    for (const meeting of extracted.meetings) {
      const startTime = parseDate(meeting.startTime);
      if (!startTime) {
        skippedMeetings += 1;
        continue;
      }
      const attendees = [input.fromAddress, ...(meeting.attendees ?? [])].filter(
        Boolean
      );
      await createMeeting({
        contactId,
        title: meeting.title,
        description: meeting.description ?? null,
        location: meeting.location ?? null,
        startTime,
        endTime: parseDate(meeting.endTime),
        attendees,
      });
      meetingCount += 1;
    }
  }

  return {
    taskCount,
    updatedTaskCount,
    completedTaskCount,
    cancelledTaskCount,
    dealCount,
    meetingCount,
    skippedMeetings,
  };
}
