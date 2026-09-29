import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { zohoWebhookPayloadSchema } from "../../../../lib/schemas/zoho";
import { classifyBusinessEmail } from "../../../../lib/classify/business-classifier";
import type { BusinessCategory } from "../../../../lib/classify/categories";
import { publishNewEmail } from "../../../../lib/realtime/email-events";
import {
  processEmailWithLLM,
  replyTextToHtml,
} from "../../../../lib/reply/llm-orchestrator";
import {
  buildReplyCcEmails,
  getPrimaryTeamMemberForRole,
  isActiveRouteTarget,
} from "../../../../lib/reply/team-roster";
import { extractAndSaveActionItems } from "../../../../lib/extract/action-items";
import { extractAndSaveProperty } from "../../../../lib/extract/property";
import { persistApprovedDraftMemory } from "../../../../lib/memory/persist-episodic";
import { stripQuotedText } from "../../../../lib/email/strip-quoted";
import { screenInboundEmail } from "../../../../lib/spam/screen";
import { isSenderBlocked } from "../../../../lib/spam/blocklist";
import { unsubscribeLabel } from "../../../../lib/email/parse-headers";
import {
  storeInboundEmail,
  storeOutboundEmail,
} from "../../../../lib/email/store-email";
import { ZohoService } from "../../../../services/zoho.service";
import {
  buildZohoEmailUrl,
  draftReferenceBlockHtml,
  resolveEmailLinkTarget,
} from "../../../../lib/zoho/email-link";
import { EVERNOTE_FORWARD, REPLY_SIGNER } from "../../../../lib/reply/business-knowledge";
import { sendProposalDetailsToEvernote } from "../../../../lib/integrations/evernote";
import {
  parseRouteToFromHandoffBody,
  sendHandoffDetailsToTeammate,
} from "../../../../lib/integrations/teammate-handoff-email";
import {
  buildHandoffTaskTitle,
  handoffPriorityToTaskPriority,
  parseHandoffField,
} from "../../../../lib/integrations/handoff-task";
import { getOrCreateTenant } from "../../../../lib/tenant";
import { upsertContact, upsertEmailTask } from "../../../../lib/tools";
import { logTaskAssignment } from "../../../../lib/repositories/task-audit";
import type { RouteToTeammate } from "../../../../lib/reply/business-knowledge";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

async function logAutoAssignment(input: {
  taskId: string;
  assignee: RouteToTeammate;
  taskTitle: string;
  created: boolean;
}): Promise<void> {
  if (!input.created) return;
  await logTaskAssignment({
    taskId: input.taskId,
    actorName: REPLY_SIGNER,
    assignee: input.assignee,
    taskTitle: input.taskTitle,
  });
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isAuthorizedWebhook(request: NextRequest): boolean {
  const secret = process.env.ZOHO_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[Zoho Webhook] ZOHO_WEBHOOK_SECRET is not set — rejecting. Set it and " +
        "append ?secret=<value> to the webhook URL configured in Zoho."
    );
    return false;
  }
  const provided =
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("x-webhook-secret") ??
    "";
  return safeEqual(provided, secret);
}

const FILTERED_FOLDER = process.env.ZOHO_FILTERED_FOLDER?.trim() || "Filtered";

async function fileSpamAway(
  messageId: string | undefined,
  folderId: string | undefined
): Promise<void> {
  if (!messageId) return;
  try {
    const dest = await ZohoService.getOrCreateFolderIdByName(FILTERED_FOLDER);
    if (folderId && dest === folderId) return; // already filed
    await ZohoService.moveMessage(messageId, dest);
  } catch (err) {
    console.warn(`  ⚠️  could not move message to "${FILTERED_FOLDER}":`, err);
  }
}

async function claimWebhook(dedupKey: string): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { messageId: dedupKey } });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    console.warn("[Zoho Webhook] dedup claim errored; processing anyway:", err);
    return true;
  }
}

async function originalMessageId(
  messageId: string | undefined,
  folderId: string | undefined
): Promise<string | undefined> {
  if (!messageId || !folderId) return undefined;
  try {
    const header = await ZohoService.getEmailHeader(messageId, folderId);
    const m = header.match(/^Message-ID:\s*(<[^>]+>)/im);
    return m?.[1];
  } catch (err) {
    console.warn("  ⚠️  could not read original Message-ID for threading:", err);
    return undefined;
  }
}

function isNoReplySender(from: string): boolean {
  return /(^|[._-])(no-?reply|donotreply|notifications?|mailer-daemon)@/.test(
    from.toLowerCase()
  );
}

const AUTO_SEND_SENDERS = new Set(["adnannalvi675@gmail.com"]);

function isAutoSendSender(from: string): boolean {
  if (process.env.AUTO_SEND_ENABLED === "true") return true;
  return AUTO_SEND_SENDERS.has(from.trim().toLowerCase());
}

function isNonReplyableSender(from: string): boolean {
  const addr = from.toLowerCase();
  return addr.includes("@myautogate.com") || isNoReplySender(addr);
}

function isInternalAddress(addr: string): boolean {
  return addr.trim().toLowerCase().includes("@myautogate.com");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn("[Zoho Webhook] body is not JSON:", raw.slice(0, 200));
    return NextResponse.json({ received: true });
  }

  const parsed = zohoWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[Zoho Webhook] unexpected payload shape:", parsed.error.message);
    return NextResponse.json({ received: true });
  }

  const email = parsed.data;
  const messageId = email.messageIdString ?? email.messageId ?? "(unknown)";

  console.log("\n========== [Zoho Webhook] new email ==========");
  console.log(`  from:    ${email.sender} <${email.fromAddress}>`);
  console.log(`  to:      ${email.toAddress}`);
  console.log(`  subject: ${email.subject}`);
  console.log(`  msgId:   ${messageId}  (receivedTime: ${email.receivedTime ?? "?"})`);

  if (messageId !== "(unknown)") {
    const dedupKey = email.messageIdString
      ? email.messageIdString
      : `${email.messageId}|${email.receivedTime ?? ""}`;
    if (!(await claimWebhook(dedupKey))) {
      console.log("  ⏭️  duplicate webhook (already handled) — skipping");
      console.log("==============================================\n");
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  publishNewEmail({
    messageId,
    subject: email.subject,
    from: email.fromAddress,
    sender: email.sender,
    folderId: email.folderId,
    receivedAt:
      typeof email.receivedTime === "number"
        ? email.receivedTime
        : Number(email.receivedTime) || 0,
  });

  const bodyText = htmlToText(email.html) || email.summary;
  console.log(`  bodyText: ${bodyText.length} chars`);

  const receivedAt = new Date(
    typeof email.receivedTime === "number"
      ? email.receivedTime
      : Number(email.receivedTime) || Date.now()
  );
  try {
    await storeInboundEmail({
      messageId: email.messageIdString ?? email.messageId,
      threadId: email.threadId,
      folderId: email.folderId,
      fromAddress: email.fromAddress,
      fromName: email.sender,
      toAddress: email.toAddress,
      subject: email.subject,
      bodyText,
      bodyHtml: email.html,
      receivedAt,
    });
  } catch (err) {
    console.warn("  ⚠️  could not archive inbound email:", err);
  }

  if (email.fromAddress && (await isSenderBlocked(email.fromAddress))) {
    console.log(`  🚫 blocked sender — ${email.fromAddress}`);
    await fileSpamAway(email.messageIdString ?? email.messageId, email.folderId);
    console.log(`  🗂️  moved to "${FILTERED_FOLDER}"; skipping (sender blocked)`);
    console.log("==============================================\n");
    return NextResponse.json({ received: true, blocked: true });
  }

  let hasOutboundMessage = false;
  if (email.threadId) {
    try {
      const outboundCount = await prisma.storedEmail.count({
        where: {
          threadId: email.threadId,
          direction: "OUTBOUND",
        },
      });
      if (outboundCount > 0) {
        hasOutboundMessage = true;
        console.log(`  ✉️  thread has outbound/sales team reply history — bypassing spam check`);
      }
    } catch (err) {
      console.warn("  ⚠️  failed to check outbound message existence:", err);
    }
  }

  if (process.env.SPAM_FILTER_ENABLED !== "false" && !hasOutboundMessage) {
    try {
      const screen = await screenInboundEmail({
        messageId: email.messageIdString ?? email.messageId,
        folderId: email.folderId,
        fromAddress: email.fromAddress,
        subject: email.subject,
        bodyText,
      });
      if (screen.isSpam) {
        console.log(`  🚫 ${screen.category} — ${screen.reason}`);
        const link = unsubscribeLabel(screen.unsubscribe);
        if (link) {
          console.log(
            `  🔗 unsubscribe: ${link}` +
              (screen.unsubscribe?.oneClick ? " (one-click available)" : "")
          );
        }

        if (screen.category === "automated") {
          console.log(
            "  📥  automated (e.g. out-of-office) — kept in inbox; skipping reply + extraction only"
          );
        } else {
          await fileSpamAway(email.messageIdString ?? email.messageId, email.folderId);
          console.log(
            `  🗂️  moved to "${FILTERED_FOLDER}"; skipping draft + extraction`
          );
        }
        console.log("==============================================\n");
        return NextResponse.json({ received: true, filtered: true });
      }
    } catch (err) {
      console.warn("  ⚠️  spam screening failed; processing normally:", err);
    }
  }

  // classifyBusinessEmail's result only ever feeds the log line below — it
  // doesn't gate replyableSender or any other decision — so skip the LLM
  // call entirely for senders we already know we won't draft/extract for
  // (our own outbound replies re-fired by Zoho, and no-reply automation).
  const replyableSender = !isNonReplyableSender(email.fromAddress);
  let category: BusinessCategory | null = null;
  if (replyableSender) {
    try {
      const classification = await classifyBusinessEmail({
        from: email.fromAddress,
        subject: email.subject,
        bodyText,
      });
      category = classification.category;
      console.log(
        `  🏷️  category: ${classification.label} ` +
          `(${Math.round(classification.confidence * 100)}%) — ${classification.reason}`
      );
    } catch (err) {
      console.warn("  ⚠️  classification failed:", err);
    }
  } else {
    console.log(`  🏷️  category: skipped — "${email.fromAddress}" is internal/no-reply`);
  }

  const hasRecipient = Boolean(email.fromAddress);
  console.log(
    `  decision: category=${category ?? "(none)"} · ` +
      `replyableSender=${replyableSender} · hasRecipient=${hasRecipient}`
  );

  let directTaskCreated = false;
  if (!replyableSender) {
    console.log(
      `  ⏭️  no draft — sender "${email.fromAddress}" is internal / no-reply`
    );
  } else if (!hasRecipient) {
    console.log("  ⏭️  no draft — missing sender address to reply to");
  } else {
    try {
      const reply = await processEmailWithLLM({
        senderName: email.sender,
        fromAddress: email.fromAddress,
        subject: email.subject,
        bodyText,
        messageId: email.messageIdString ?? email.messageId,
        folderId: email.folderId,
        threadId: email.threadId,
      });

      if (reply.llmFailed) {
        console.error(
          "\n" +
          "╔══════════════════════════════════════════════════════════════╗\n" +
          "║  🚨  LLM FAILED — EMAIL SUPPRESSED FOR MANUAL REVIEW  🚨   ║\n" +
          `║  From   : ${email.fromAddress.padEnd(49)}║\n` +
          `║  Subject: ${email.subject.slice(0, 49).padEnd(49)}║\n` +
          "║  Action : Draft/send SKIPPED. Check inbox manually.        ║\n" +
          "╚══════════════════════════════════════════════════════════════╝"
        );
        for (const note of reply.followUp) {
          console.error(`  ⛔  ${note}`);
        }
        return NextResponse.json({ received: true, llmFailed: true }); // abort — no email sent
      }

      const replyText = reply.replyText;
      console.log(`  ✍️  ${replyText.length} chars generated`);
      for (const step of reply.followUp) {
        console.log(`    ↳ reviewer note: ${step}`);
      }

      const msgId = email.messageIdString ?? email.messageId;
      const emailLinkTarget =
        msgId
          ? await resolveEmailLinkTarget({
              messageId: msgId,
              folderId: email.folderId,
              threadId: email.threadId,
            })
          : null;

      if (reply.evernotePayload) {
        const isScheduling = Boolean(reply.schedulingTask);
        const isAdmin = Boolean(reply.adminTask);
        const taskTitle = isScheduling
          ? `${EVERNOTE_FORWARD.schedulingSubjectSuffix} ${email.subject}`.trim()
          : isAdmin
            ? `${EVERNOTE_FORWARD.adminSubjectSuffix} ${email.subject}`.trim()
            : `${EVERNOTE_FORWARD.subjectSuffix} ${email.subject}`.trim();
        const zohoUrl = emailLinkTarget
          ? buildZohoEmailUrl(emailLinkTarget)
          : null;
        const taskDescription = zohoUrl
          ? `${reply.evernotePayload}\n\nZoho Email: ${zohoUrl}`
          : reply.evernotePayload;

        console.log(
          isScheduling
            ? "  📋  Evernote — scheduling handoff for Sarah…"
            : isAdmin
              ? "  📋  Evernote — admin/CRM handoff for Beverly…"
              : "  📋  Evernote task inbox — emailing proposal details…"
        );
        console.log(taskDescription);
        try {
          await sendProposalDetailsToEvernote({
            title: taskTitle,
            body: taskDescription,
          });
          console.log(
            `  ✅  Evernote task-inbox email sent to ${EVERNOTE_FORWARD.address}`
          );

          const routeTo = parseRouteToFromHandoffBody(reply.evernotePayload);
          if (routeTo) {
            try {
              const sentTo = await sendHandoffDetailsToTeammate({
                routeTo,
                customerSubject: email.subject,
                body: taskDescription,
              });
              if (sentTo) {
                console.log(
                  `  ✅  Handoff details emailed to ${routeTo} (${sentTo})`
                );
              }
            } catch (err) {
              console.error(
                `  ❌  Failed to email handoff details to ${routeTo}:`,
                err
              );
            }

            if (await isActiveRouteTarget(routeTo)) {
              const scheduler = await getPrimaryTeamMemberForRole("scheduler");
              const adminHandler = await getPrimaryTeamMemberForRole("admin_handler");
              const skipDedicatedHandoffTask =
                (routeTo === scheduler?.name && reply.schedulingTask) ||
                (routeTo === adminHandler?.name && reply.adminTask);
              if (!skipDedicatedHandoffTask) {
              try {
                const contact = await upsertContact({
                  email: email.fromAddress,
                  name: email.sender,
                });
                const handoffKind = isScheduling
                  ? "scheduling"
                  : isAdmin
                    ? "admin"
                    : taskDescription.includes("Declined —")
                      ? "decline"
                      : "proposal";
                const customerName = parseHandoffField(
                  reply.evernotePayload,
                  "Customer / Property"
                );
                const { task, created } = await upsertEmailTask({
                  contactId: contact.id,
                  assignee: routeTo,
                  title: buildHandoffTaskTitle({
                    routeTo,
                    customerSubject: email.subject,
                    customerName,
                    handoffKind,
                  }),
                  description: taskDescription,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  status: handoffKind === "decline" ? ("DECLINED" as any) : undefined,
                  priority: handoffPriorityToTaskPriority(
                    parseHandoffField(reply.evernotePayload, "Priority")
                  ),
                  sourceFrom: email.fromAddress,
                  sourceSubject: email.subject,
                  sourceBody: bodyText,
                });
                console.log(
                  `  ✅  ${routeTo} task ${created ? "created" : "updated"}: "${task.title}"`
                );
                await logAutoAssignment({
                  taskId: task.id,
                  assignee: routeTo,
                  taskTitle: task.title,
                  created,
                });
                directTaskCreated = true;
              } catch (err) {
                console.error(`  ❌  Failed to create ${routeTo} routed task:`, err);
              }
              }
            }
          } else {
            console.warn(
              "  ⚠️  Evernote sent but no Route To line — skipped teammate email"
            );
          }
        } catch (err) {
          console.error("  ❌  Failed to send Evernote task-inbox email:", err);
        }
      }

      if (reply.schedulingTask) {
        try {
          const scheduler = await getPrimaryTeamMemberForRole("scheduler");
          const assignee = scheduler?.name ?? "Sarah";
          const contact = await upsertContact({
            email: email.fromAddress,
            name: email.sender,
          });
          const { task, created } = await upsertEmailTask({
            contactId: contact.id,
            assignee,
            title: reply.schedulingTask.title,
            description: reply.schedulingTask.description,
            priority: "HIGH",
            sourceFrom: email.fromAddress,
            sourceSubject: email.subject,
            sourceBody: bodyText,
          });
          console.log(
            `  ✅  ${assignee} scheduling task ${created ? "created" : "updated"}: "${task.title}"`
          );
          await logAutoAssignment({
            taskId: task.id,
            assignee,
            taskTitle: task.title,
            created,
          });
          directTaskCreated = true;
        } catch (err) {
          console.error("  ❌  Failed to create Sarah scheduling task:", err);
        }
      }

      if (reply.adminTask) {
        try {
          const adminHandler = await getPrimaryTeamMemberForRole("admin_handler");
          const assignee = adminHandler?.name ?? "Beverly";
          const contact = await upsertContact({
            email: email.fromAddress,
            name: email.sender,
          });
          const { task, created } = await upsertEmailTask({
            contactId: contact.id,
            assignee,
            title: reply.adminTask.title,
            description: reply.adminTask.description,
            priority: "HIGH",
            sourceFrom: email.fromAddress,
            sourceSubject: email.subject,
            sourceBody: bodyText,
          });
          console.log(
            `  ✅  ${assignee} admin task ${created ? "created" : "updated"}: "${task.title}"`
          );
          await logAutoAssignment({
            taskId: task.id,
            assignee,
            taskTitle: task.title,
            created,
          });
          directTaskCreated = true;
        } catch (err) {
          console.error("  ❌  Failed to create Beverly admin task:", err);
        }
      }

      console.log(`  ✍️  generated ${replyText.length} chars; saving draft…`);

      const subject = email.subject.trim().toLowerCase().startsWith("re:")
        ? email.subject
        : `Re: ${email.subject}`;

      const signatureHtml = await ZohoService.getSignatureHtml();
      const referenceHtml = draftReferenceBlockHtml({
        fromAddress: email.fromAddress,
        fromName: email.sender,
        subject: email.subject,
        bodyText,
        receivedAt,
      });
      const bodyHtml = replyTextToHtml(replyText);
      const signatureSuffix = signatureHtml ? `<br><br>${signatureHtml}` : "";
      const replyHtmlForSend = bodyHtml + signatureSuffix;
      const replyHtmlForDraft = bodyHtml + referenceHtml + signatureSuffix;

      const cc = await buildReplyCcEmails(
        replyText,
        reply.ccTeammates ?? []
      );
      const ccAddress = cc.length ? cc.join(",") : undefined;
      if (ccAddress) {
        console.log(`  👥  looping in teammate(s): ${ccAddress}`);
      } else if (reply.schedulingTask) {
        console.warn(
          "  ⚠️  scheduling handoff but CC is empty — Sarah not found in AUTOGATE_TEAM roster"
        );
      } else if (reply.adminTask) {
        console.warn(
          "  ⚠️  admin handoff but CC is empty — Beverly not found in AUTOGATE_TEAM roster"
        );
      }

      const replyParamsBase = {
        toAddress: email.fromAddress,
        subject,
        ccAddress,
      };

      const autoSend = isAutoSendSender(email.fromAddress);

      if (autoSend) {
        const originalId = email.messageIdString ?? email.messageId;
        if (originalId) {
          await ZohoService.replyToMessage({
            originalMessageId: originalId,
            ...replyParamsBase,
            content: replyHtmlForSend,
          });
        } else {
          await ZohoService.sendEmail({
            ...replyParamsBase,
            content: replyHtmlForSend,
          });
        }
        console.log(`  ✅  reply SENT (threaded) to ${email.fromAddress}`);

        // RAG write side — only for CONFIRMED sends. Drafts saved to Zoho
        // Drafts (the `else` branch) may still be edited by a human before
        // actually going out, so we have no signal here that their text is
        // "approved" — persisting those would let unreviewed AI phrasing
        // reinforce itself. See related-history.ts for the read side.
        try {
          const memoryContact = await upsertContact({
            email: email.fromAddress,
            name: email.sender,
          });
          await persistApprovedDraftMemory({
            contactEmail: email.fromAddress,
            contactId: memoryContact.id,
            triggerText: stripQuotedText(bodyText),
            replyText,
            threadId: email.threadId ?? msgId ?? messageId,
            sourceMessageId: msgId ?? messageId,
          });
        } catch (err) {
          console.warn("  ⚠️  could not persist RAG memory for sent reply:", err);
        }
      } else {
        const inReplyTo = await originalMessageId(
          email.messageIdString ?? email.messageId,
          email.folderId
        );
        await ZohoService.saveDraft({
          ...replyParamsBase,
          content: replyHtmlForDraft,
          inReplyTo,
          refHeader: inReplyTo,
        });
        console.log(
          `  ✅  draft reply saved to Zoho Drafts${inReplyTo ? " (threaded)" : ""}`
        );
      }

      try {
        await storeOutboundEmail({
          threadId: email.threadId,
          folderId: email.folderId,
          fromAddress: email.toAddress || "", // our mailbox (inbound's To)
          toAddress: email.fromAddress, // the customer
          subject,
          bodyText: replyText,
          bodyHtml: autoSend ? replyHtmlForSend : replyHtmlForDraft,
        });
      } catch (err) {
        console.warn("  ⚠️  could not archive outbound reply:", err);
      }
    } catch (err) {
      console.error("  ❌  draft generation/save FAILED:", err);
    }
  }

  const senderIsInternal = isInternalAddress(email.fromAddress);

  if (isNoReplySender(email.fromAddress)) {
    console.log(
      `  ⏭️  skipping task extraction — "${email.fromAddress}" is automated no-reply`
    );
  } else {
    try {
      const isInternal = senderIsInternal || directTaskCreated;
      if (isInternal) {
        console.log(
          `  🔍  checking open tasks for completion/updates (internal/direct sender: "${email.fromAddress}")`
        );
      }
      const {
        taskCount,
        updatedTaskCount,
        completedTaskCount,
        cancelledTaskCount,
        dealCount,
        meetingCount,
        skippedMeetings,
      } = await extractAndSaveActionItems({
        senderName: email.sender,
        fromAddress: email.fromAddress,
        subject: email.subject,
        bodyText,
        isInternal,
      });
      if (taskCount || updatedTaskCount || completedTaskCount || cancelledTaskCount || dealCount || meetingCount) {
        console.log(
          `  📋  ${taskCount} new + ${updatedTaskCount} updated + ` +
            `${completedTaskCount} completed + ${cancelledTaskCount} cancelled task(s), ` +
            `${dealCount} deal(s), ${meetingCount} meeting(s)` +
            (skippedMeetings ? ` (${skippedMeetings} meeting(s) skipped — no time)` : "")
        );
      } else {
        console.log("  📋  no task status changes found in this email");
      }
    } catch (err) {
      console.error("  ❌  task/meeting extraction FAILED:", err);
    }
  }

  if (!isNoReplySender(email.fromAddress) && !senderIsInternal) {
    try {
      const propertyResult = await extractAndSaveProperty({
        senderName: email.sender,
        fromAddress: email.fromAddress,
        subject: email.subject,
        bodyText,
        messageId: email.messageIdString ?? email.messageId,
        threadId: email.threadId,
        receivedAt,
      });
      if (propertyResult.saved) {
        console.log(
          `  🏢  property ${propertyResult.created ? "created" : "updated"}: "${propertyResult.name}" (${propertyResult.propertyId})` +
            (propertyResult.riskFlagged ? " — ⚠️ risk alert task raised" : "")
        );
      }
    } catch (err) {
      console.error("  ❌  property extraction FAILED:", err);
    }
  }

  console.log("==============================================\n");

  return NextResponse.json({ received: true });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, message: "Zoho webhook endpoint is live" });
}
