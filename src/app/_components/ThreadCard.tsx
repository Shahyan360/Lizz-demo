import { DraftStatus } from "@prisma/client";
import type { ThreadWithDetails } from "../../lib/db-types";
import { isNonDraftCategory } from "../../lib/email-classifier";
import {
  approveDraft,
  retryDraftSend,
  updateDraftText,
} from "../actions/draft.actions";
import { PendingForm } from "./PendingForm";
import { SubmitButton } from "./SubmitButton";

interface ThreadCardProps {
  thread: ThreadWithDetails;
}

type DraftWithDetails = ThreadWithDetails["drafts"][number];

/** Renders one inbox thread: the incoming message plus its AI draft, or a
 *  muted badge when the message was classified out (promotional/automated). */
export function ThreadCard({ thread }: ThreadCardProps) {
  // Messages are ordered newest-first; show the latest INCOMING message (an
  // approved reply persists an outgoing message that must not be shown here).
  const latestMsg =
    thread.messages.find((message) => message.isIncoming) ??
    thread.messages[0];
  const latestDraft = thread.drafts[0];
  const urgency = latestMsg?.urgency ?? 0;
  const intent = latestMsg?.intent ?? "unknown";
  const skipped = !latestDraft && isNonDraftCategory(latestMsg?.intent);
  const recipient =
    latestMsg?.sender.match(/<([^>]+)>/)?.[1] ??
    latestMsg?.sender ??
    "the recipient";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.25rem",
          borderBottom: "1px solid var(--border-color)",
          background: "rgba(255, 255, 255, 0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {latestMsg?.sender.split("<")[0].trim() || "Unknown sender"}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              {latestMsg?.sender.match(/<([^>]+)>/)?.[1] ?? ""}
            </span>
          </div>
          <h4
            style={{
              fontSize: "0.95rem",
              fontWeight: 500,
              marginTop: "0.25rem",
              color: "var(--text-primary)",
            }}
          >
            {thread.subject}
          </h4>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <span
            style={{
              fontSize: "0.65rem",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              fontWeight: 600,
              backgroundColor:
                urgency > 0.6
                  ? "var(--color-danger)"
                  : "var(--color-warning-glow)",
              color: urgency > 0.6 ? "#FFF" : "var(--color-warning)",
            }}
          >
            Urgency: {Math.round(urgency * 100)}%
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              fontWeight: 600,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: "var(--text-secondary)",
            }}
          >
            Intent: {intent}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "1.25rem" }}>
        <div style={{ marginBottom: latestDraft ? "1.25rem" : "0" }}>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Incoming Message
          </p>
          <div
            style={{
              background: "rgba(0,0,0,0.15)",
              padding: "1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              borderLeft: "2px solid rgba(255,255,255,0.15)",
            }}
          >
            {latestMsg?.bodyText}
          </div>
        </div>

        {latestDraft ? (
          <DraftSection draft={latestDraft} recipient={recipient} />
        ) : (
          <NonDraftNotice category={intent} skipped={skipped} />
        )}
      </div>
    </div>
  );
}

/** Muted badge for a thread that was classified out (no draft generated). */
function NonDraftNotice({
  category,
  skipped,
}: {
  category: string;
  skipped: boolean;
}) {
  const label = skipped
    ? `📭 ${capitalize(category)} — no draft generated`
    : "Awaiting draft generation";
  return (
    <div
      style={{
        marginTop: "1rem",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--border-color)",
        borderRadius: "0.5rem",
        padding: "0.6rem 0.9rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "var(--text-muted)",
      }}
    >
      {label}
    </div>
  );
}

/** The draft: an editable form, or a send-status panel, plus the audit log. */
function DraftSection({
  draft,
  recipient,
}: {
  draft: DraftWithDetails;
  recipient: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <p
          style={{
            color: "var(--color-primary)",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 700,
          }}
        >
          Generated Mimic Draft
        </p>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color:
              draft.confidence > 0.8
                ? "var(--color-success)"
                : "var(--color-warning)",
          }}
        >
          Confidence Match: {Math.round(draft.confidence * 100)}%
        </span>
      </div>

      {draft.status === DraftStatus.SENDING ? (
        <SendingPanel draft={draft} />
      ) : draft.status === DraftStatus.SENT ? (
        <SentPanel draft={draft} recipient={recipient} />
      ) : draft.status === DraftStatus.REJECTED ? (
        <RejectedPanel draft={draft} />
      ) : (
        <EditableDraftForm draft={draft} />
      )}

      <AuditBlock draft={draft} />
    </div>
  );
}

/** A read-only rendering of the draft body (non-editable states). */
function ReadOnlyDraft({ text }: { text: string }) {
  return (
    <textarea
      defaultValue={text}
      rows={5}
      disabled
      style={{
        width: "100%",
        background: "rgba(99, 102, 241, 0.03)",
        border: "1px solid rgba(99, 102, 241, 0.15)",
        borderRadius: "0.5rem",
        padding: "1rem",
        color: "var(--text-secondary)",
        fontSize: "0.85rem",
        lineHeight: 1.6,
        fontFamily: "var(--font-sans)",
        resize: "none",
        outline: "none",
        marginBottom: "1rem",
        opacity: 0.85,
      }}
    />
  );
}

/** PENDING_REVIEW — the editable textarea with Save / Approve actions. */
function EditableDraftForm({ draft }: { draft: DraftWithDetails }) {
  return (
    <PendingForm
      action={async (formData: FormData) => {
        "use server";
        const actionType = String(formData.get("actionType") ?? "");
        if (actionType === "approve") {
          await approveDraft(formData);
        } else {
          const draftId = String(formData.get("draftId") ?? "");
          const draftText = String(formData.get("draftText") ?? "");
          await updateDraftText(draftId, draftText);
        }
      }}
    >
      <input type="hidden" name="draftId" value={draft.id} />

      <textarea
        name="draftText"
        defaultValue={draft.draftText}
        rows={5}
        placeholder="Edit drafted response..."
        style={{
          width: "100%",
          background: "rgba(99, 102, 241, 0.03)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
          borderRadius: "0.5rem",
          padding: "1rem",
          color: "#FFF",
          fontSize: "0.85rem",
          lineHeight: 1.6,
          fontFamily: "var(--font-sans)",
          resize: "vertical",
          outline: "none",
          marginBottom: "1rem",
        }}
      />

      <div
        style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}
      >
        <SubmitButton
          name="actionType"
          value="save"
          pendingLabel="Saving…"
          className="transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            fontSize: "0.8rem",
            fontWeight: 500,
          }}
        >
          Save Draft Edits
        </SubmitButton>
        <SubmitButton
          name="actionType"
          value="approve"
          pendingLabel="Sending…"
          className="transition-all"
          style={{
            background:
              "linear-gradient(135deg, var(--color-success), #059669)",
            color: "#FFF",
            border: "none",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.375rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            boxShadow: "0 2px 10px rgba(16, 185, 129, 0.2)",
          }}
        >
          Approve &amp; Send Outbound
        </SubmitButton>
      </div>
    </PendingForm>
  );
}

/** SENDING — the brief intermediate lock state. */
function SendingPanel({ draft }: { draft: DraftWithDetails }) {
  return (
    <div>
      <ReadOnlyDraft text={draft.draftText} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--color-warning)",
            backgroundColor: "var(--color-warning-glow)",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
          }}
        >
          ⏳ Sending…
        </span>
      </div>
    </div>
  );
}

/** SENT — confirmed dispatch with recipient + timestamp. */
function SentPanel({
  draft,
  recipient,
}: {
  draft: DraftWithDetails;
  recipient: string;
}) {
  return (
    <div>
      <ReadOnlyDraft text={draft.draftText} />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          Sent to {recipient} at {formatSentTime(draft.updatedAt)}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            color: "var(--color-success)",
            fontSize: "0.8rem",
            fontWeight: 600,
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
          }}
        >
          ✓ Reply Dispatched Successfully
        </span>
      </div>
    </div>
  );
}

/** REJECTED — a failed send: error banner + one-click retry. */
function RejectedPanel({ draft }: { draft: DraftWithDetails }) {
  const lastRejection = draft.approvalEvents.find(
    (event) => event.action === "REJECTED"
  );
  const reason = lastRejection?.modified ?? "send_failed";

  return (
    <div>
      <ReadOnlyDraft text={draft.draftText} />
      <div
        style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          marginBottom: "0.75rem",
        }}
      >
        <p
          style={{
            color: "var(--color-danger)",
            fontSize: "0.78rem",
            fontWeight: 600,
            margin: 0,
          }}
        >
          ⚠ Send failed
        </p>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.72rem",
            margin: "0.25rem 0 0",
            lineHeight: 1.5,
          }}
        >
          {friendlyReason(reason)}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PendingForm action={retryDraftSend}>
          <input type="hidden" name="draftId" value={draft.id} />
          <SubmitButton
            pendingLabel="Retrying…"
            className="transition-all"
            style={{
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#FFF",
              border: "none",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.375rem",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            ↻ Retry Send
          </SubmitButton>
        </PendingForm>
      </div>
    </div>
  );
}

/** The collapsible reasoning log + per-agent latency trace chips. */
function AuditBlock({ draft }: { draft: DraftWithDetails }) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          background: "rgba(255, 255, 255, 0.01)",
          border: "1px solid var(--border-color)",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          fontSize: "0.8rem",
          color: "var(--text-secondary)",
        }}
      >
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              outline: "none",
              color: "var(--text-secondary)",
            }}
          >
            💡 Audit Reasoning Log ({draft.reviewLevel})
          </summary>
          <pre
            style={{
              marginTop: "0.5rem",
              paddingLeft: "1rem",
              borderLeft: "1px solid var(--border-color)",
              fontFamily: "inherit",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
            }}
          >
            {draft.reasoningLog ?? "No reasoning log recorded."}
          </pre>
        </details>
      </div>

      {draft.aiTraces.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "0.75rem",
          }}
        >
          {draft.aiTraces.map((trace) => (
            <span
              key={trace.id}
              style={{
                fontSize: "0.65rem",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-color)",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                color: "var(--text-muted)",
              }}
            >
              ⚡ {trace.pipelineStep}: {trace.latencyMs}ms
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Maps a machine reason code from a failed send to a human-readable message. */
function friendlyReason(reason: string): string {
  const map: Record<string, string> = {
    auth_failed:
      "Gmail authorization failed. Reconnect the mailbox, then retry.",
    account_disconnected:
      "The Gmail mailbox for this thread was disconnected. Reconnect it to send.",
    malformed_recipient: "The recipient's email address is invalid.",
    empty_draft: "The draft is empty — add a reply before sending.",
    missing_incoming_message:
      "The original incoming message could not be found.",
    network_error:
      "Could not reach Gmail (network error). Check the connection and retry.",
    send_failed: "The reply could not be sent. Retry shortly.",
  };
  if (map[reason]) {
    return map[reason];
  }
  if (reason.startsWith("gmail_unavailable")) {
    return "Gmail is temporarily unavailable. Retrying shortly should work.";
  }
  if (reason.startsWith("gmail_rejected")) {
    return "Gmail rejected the message. Review the draft and recipient.";
  }
  return `Send failed: ${reason}`;
}

/** Formats a send timestamp, e.g. "May 19, 2:32 PM". */
function formatSentTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function capitalize(value: string): string {
  return value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;
}
