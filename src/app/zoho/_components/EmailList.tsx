"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import {
  EMAIL_PAGE_SIZE,
  type EmailItem,
  type EmailAttachment,
} from "./email-item";
import { initials, avatarGradient, plainToHtml, LIGHT } from "./ui";
import { AutoReplyModal } from "./AutoReplyModal";
import { useToast } from "../../_components/Toast";
import { useConfirm } from "../../_components/ConfirmDialog";
import { Loader } from "../../_components/Loader";
import { RichEditor } from "../../_components/RichEditor";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  BUSINESS_CATEGORIES,
  type BusinessCategory,
  type EmailClassification,
} from "../../../lib/classify/categories";
import type { UnsubscribeInfo } from "../../../lib/email/parse-headers";

/** Per-message fetch state for the reading pane. */
interface MessageDetailState {
  loading: boolean;
  error: string | null;
  data?: {
    header: string;
    content: string;
    classification: EmailClassification | null;
    attachments: EmailAttachment[];
    unsubscribe?: UnsubscribeInfo | null;
  };
}

/**
 * Three-pane mailbox body: a compact email list on the left and a reading pane
 * on the right (folders live in the page's sidebar). Selecting a row loads its
 * full message into the reading pane; lazy "Load More" pages the list.
 */
export function EmailList({
  accountId,
  folderId,
  initialEmails,
  initialMessageId,
  initialMessageFolderId,
  isDraftsFolder = false,
  isTrashFolder = false,
}: {
  accountId: string;
  folderId: string;
  initialEmails: EmailItem[];
  initialMessageId?: string;
  initialMessageFolderId?: string;
  isDraftsFolder?: boolean;
  isTrashFolder?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [emails, setEmails] = useState<EmailItem[]>(initialEmails);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reachedEnd, setReachedEnd] = useState(
    initialEmails.length < EMAIL_PAGE_SIZE
  );

  const [refreshing, setRefreshing] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedEmail, setPinnedEmail] = useState<EmailItem | null>(null);
  const [details, setDetails] = useState<Record<string, MessageDetailState>>({});
  const [live, setLive] = useState(false);
  const deepLinkOpened = useRef(false);

  // Full-mailbox search. `searchQuery` is the submitted term (drives the view);
  // `searchInput` is the live text box value.
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmailItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchActive = searchQuery.trim().length > 0;

  // Category filter (AI-classified). "all" = no filtering / no AI cost.
  const [filter, setFilter] = useState<BusinessCategory | "all">("all");
  const [catMap, setCatMap] = useState<Record<string, BusinessCategory>>({});
  const [filtering, setFiltering] = useState(false);

  // When a category filter is active, classify any loaded emails we haven't yet.
  useEffect(() => {
    if (filter === "all") return;
    const need = emails.filter((e) => !(e.messageId in catMap));
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      setFiltering(true);
      try {
        const res = await fetch("/api/zoho/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: need.map((e) => ({
              messageId: e.messageId,
              from: e.from,
              subject: e.subject,
              summary: e.summary,
            })),
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          categories?: Record<string, BusinessCategory>;
        } | null;
        if (!cancelled && data?.categories) {
          setCatMap((prev) => ({ ...prev, ...data.categories }));
        }
      } catch {
        /* leave unclassified; they just won't match a specific filter */
      } finally {
        if (!cancelled) setFiltering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, emails]);

  const visibleEmails =
    filter === "all"
      ? emails
      : emails.filter((e) => catMap[e.messageId] === filter);

  // Per-category counts over the loaded emails (available once classified).
  const counts: Partial<Record<BusinessCategory, number>> = {};
  for (const e of emails) {
    const c = catMap[e.messageId];
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }
  const anyClassified = Object.keys(counts).length > 0;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        accountId,
        folderId,
        start: "1",
        limit: String(EMAIL_PAGE_SIZE),
      });
      const res = await fetch(`/api/zoho/emails?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const page = (await res.json()) as EmailItem[];
      setEmails(page);
      setReachedEnd(page.length < EMAIL_PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [accountId, folderId]);

  useEffect(() => {
    const es = new EventSource("/api/zoho/stream");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("new-email", () => refresh());
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    if (!initialMessageId || deepLinkOpened.current) return;
    deepLinkOpened.current = true;

    const msgFolderId = initialMessageFolderId ?? folderId;
    const inList = initialEmails.find((e) => e.messageId === initialMessageId);
    if (inList) {
      void selectEmail(initialMessageId, inList.folderId ?? msgFolderId);
      return;
    }

    void (async () => {
      try {
        const params = new URLSearchParams({
          accountId,
          folderId: msgFolderId,
          messageId: initialMessageId,
        });
        const res = await fetch(`/api/zoho/message?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { header?: string };
        const from = deepLinkHeaderValue(data.header ?? "", "From");
        const subject = deepLinkHeaderValue(data.header ?? "", "Subject");
        setPinnedEmail({
          messageId: initialMessageId,
          folderId: msgFolderId,
          senderName: from.replace(/<.*>/, "").replace(/"/g, "").trim() || from,
          from,
          to: deepLinkHeaderValue(data.header ?? "", "To"),
          subject: subject || "(no subject)",
          summary: "",
          receivedAtLabel: deepLinkHeaderValue(data.header ?? "", "Date"),
        });
        await selectEmail(initialMessageId, msgFolderId);
      } catch {
        /* deep link is best-effort */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessageId, initialMessageFolderId, accountId, folderId]);

  async function selectEmail(messageId: string, msgFolderId?: string) {
    setSelectedId(messageId);
    if (details[messageId]?.data) return;

    setDetails((prev) => ({
      ...prev,
      [messageId]: { loading: true, error: null },
    }));
    try {
      const params = new URLSearchParams({
        accountId,
        folderId: msgFolderId ?? folderId,
        messageId,
      });
      const res = await fetch(`/api/zoho/message?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        header: string;
        content: string;
        classification: EmailClassification | null;
        attachments?: EmailAttachment[];
        unsubscribe?: UnsubscribeInfo | null;
      };
      setDetails((prev) => ({
        ...prev,
        [messageId]: {
          loading: false,
          error: null,
          data: { ...data, attachments: data.attachments ?? [] },
        },
      }));
    } catch (e) {
      setDetails((prev) => ({
        ...prev,
        [messageId]: {
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  }

  async function runSearch() {
    const q = searchInput.trim();
    setSearchQuery(q);
    if (!q) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ accountId, q, limit: "40" });
      const res = await fetch(`/api/zoho/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Request failed (${res.status})`);
      }
      setSearchResults((await res.json()) as EmailItem[]);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchInput("");
    setSearchQuery("");
    setSearchResults(null);
    setSearchError(null);
  }

  function dropEmail(messageId: string) {
    setEmails((prev) => prev.filter((x) => x.messageId !== messageId));
    setSearchResults((prev) =>
      prev ? prev.filter((x) => x.messageId !== messageId) : prev
    );
    setSelectedId((cur) => (cur === messageId ? null : cur));
  }

  async function deleteEmail(messageId: string, msgFolderId?: string) {
    const useFolder = msgFolderId ?? folderId;
    const permanent = isTrashFolder;
    const ok = await confirm({
      title: permanent ? "Delete forever?" : "Move to Trash?",
      message: permanent
        ? "This email will be permanently deleted. This cannot be undone."
        : "This email will be moved to the Trash folder.",
      confirmLabel: permanent ? "Delete forever" : "Move to Trash",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(messageId);
    try {
      const res = await fetch("/api/zoho/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          folderId: useFolder,
          messageId,
          action: "delete",
          expunge: permanent,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Request failed (${res.status})`);
      }
      dropEmail(messageId);
      toast.success(permanent ? "Deleted permanently" : "Moved to Trash");
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function restoreEmail(messageId: string) {
    setDeletingId(messageId);
    try {
      const res = await fetch("/api/zoho/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, folderId, messageId, action: "restore" }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Request failed (${res.status})`);
      }
      dropEmail(messageId);
      toast.success("Restored to Inbox");
    } catch (e) {
      toast.error(`Restore failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function emptyTrash() {
    const ok = await confirm({
      title: "Empty Trash?",
      message:
        "All emails in Trash will be permanently deleted. This cannot be undone.",
      confirmLabel: "Empty Trash",
      danger: true,
    });
    if (!ok) return;
    setEmptying(true);
    try {
      const res = await fetch("/api/zoho/empty-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, folderId }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Request failed (${res.status})`);
      }
      setSelectedId(null);
      await refresh();
      toast.success("Trash emptied");
    } catch (e) {
      toast.error(
        `Empty Trash failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setEmptying(false);
    }
  }

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const start = emails.length + 1;
      const params = new URLSearchParams({
        accountId,
        folderId,
        start: String(start),
        limit: String(EMAIL_PAGE_SIZE),
      });
      const res = await fetch(`/api/zoho/emails?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const page = (await res.json()) as EmailItem[];
      setEmails((prev) => [...prev, ...page]);
      if (page.length < EMAIL_PAGE_SIZE) setReachedEnd(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Selection can point at a search result (which may live in another folder).
  const activePool = searchActive ? searchResults ?? [] : emails;
  const selectedEmail =
    activePool.find((e) => e.messageId === selectedId) ??
    (pinnedEmail && pinnedEmail.messageId === selectedId ? pinnedEmail : null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        position: "relative",
      }}
    >
      {emptying && <Loader overlay label="Emptying Trash…" />}

      {/* Category filter bar — spans the full width, above both panes. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.55rem 0.9rem",
          borderBottom: `1px solid ${LIGHT.border}`,
          background: LIGHT.panelAlt,
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: LIGHT.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginRight: "0.25rem",
            flexShrink: 0,
          }}
        >
          Filter
        </span>
        <FilterChip
          label={`All (${emails.length})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {BUSINESS_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            label={
              anyClassified
                ? `${CATEGORY_LABELS[cat]} (${counts[cat] ?? 0})`
                : CATEGORY_LABELS[cat]
            }
            active={filter === cat}
            color={CATEGORY_COLORS[cat].fg}
            onClick={() => setFilter(cat)}
          />
        ))}
        {filtering && (
          <span
            className="spinner"
            style={{ width: "0.8rem", height: "0.8rem", color: LIGHT.accent }}
          />
        )}
      </div>

      {/* Two-pane body: list | reading */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 360px) 1fr",
          flex: 1,
          minHeight: 0,
        }}
      >
      {/* LIST COLUMN */}
      <div
        style={{
          borderRight: `1px solid ${LIGHT.border}`,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: LIGHT.panel,
        }}
      >
        {/* Search box — searches the whole mailbox */}
        <div
          style={{
            padding: "0.55rem 0.7rem",
            borderBottom: `1px solid ${LIGHT.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span
              style={{
                position: "absolute",
                left: 9,
                color: LIGHT.textMuted,
                fontSize: "0.8rem",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
                else if (e.key === "Escape") clearSearch();
              }}
              placeholder="Search all mail…"
              style={{
                width: "100%",
                padding: "0.45rem 1.9rem 0.45rem 2rem",
                borderRadius: 8,
                border: `1px solid ${LIGHT.borderStrong}`,
                background: "#fff",
                color: LIGHT.text,
                fontSize: "0.82rem",
                outline: "none",
              }}
            />
            {(searchInput || searchActive) && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                title="Clear search"
                style={{
                  position: "absolute",
                  right: 6,
                  border: "none",
                  background: "transparent",
                  color: LIGHT.textMuted,
                  fontSize: "1rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: "0.15rem 0.3rem",
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            padding: "0.6rem 0.8rem",
            borderBottom: `1px solid ${LIGHT.border}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.78rem",
              color: LIGHT.textSecondary,
              fontWeight: 600,
            }}
          >
            {searchActive
              ? `${searchResults?.length ?? 0} result${
                  (searchResults?.length ?? 0) === 1 ? "" : "s"
                } for “${searchQuery}”`
              : `${emails.length} email${emails.length === 1 ? "" : "s"}`}
            <span
              title={live ? "Live updates on" : "Reconnecting…"}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: live ? LIGHT.success : LIGHT.textMuted,
              }}
            />
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {isTrashFolder && emails.length > 0 && (
              <button
                type="button"
                onClick={emptyTrash}
                disabled={emptying}
                title="Empty Trash"
                style={iconBtn(LIGHT.danger)}
              >
                🧹
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              title="Refresh"
              style={iconBtn(LIGHT.textSecondary)}
            >
              {refreshing ? <span className="spinner" /> : "↻"}
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {searchActive ? (
            /* ── Search results (whole mailbox) ── */
            searching ? (
              <p style={searchNotice}>
                <span className="spinner" style={{ width: 13, height: 13 }} /> Searching…
              </p>
            ) : searchError ? (
              <p style={{ ...searchNotice, color: LIGHT.danger }}>{searchError}</p>
            ) : (searchResults?.length ?? 0) === 0 ? (
              <p style={searchNotice}>No emails match “{searchQuery}”.</p>
            ) : (
              searchResults!.map((email) => (
                <EmailRow
                  key={email.messageId}
                  email={email}
                  selected={email.messageId === selectedId}
                  onSelect={() => selectEmail(email.messageId, email.folderId)}
                  onDelete={() => deleteEmail(email.messageId, email.folderId)}
                  deleting={deletingId === email.messageId}
                  isTrash={isTrashFolder}
                />
              ))
            )
          ) : emails.length === 0 ? (
            <p
              style={{
                color: LIGHT.textMuted,
                fontSize: "0.85rem",
                padding: "1.5rem",
                textAlign: "center",
              }}
            >
              No emails in this folder.
            </p>
          ) : visibleEmails.length === 0 ? (
            <p
              style={{
                color: LIGHT.textMuted,
                fontSize: "0.85rem",
                padding: "1.5rem",
                textAlign: "center",
              }}
            >
              {filtering
                ? "Classifying emails…"
                : `No ${filter === "all" ? "" : CATEGORY_LABELS[filter as BusinessCategory]} emails in the loaded list.`}
            </p>
          ) : (
            visibleEmails.map((email) => (
              <EmailRow
                key={email.messageId}
                email={email}
                selected={email.messageId === selectedId}
                onSelect={() => selectEmail(email.messageId, email.folderId)}
                onDelete={() => deleteEmail(email.messageId, email.folderId)}
                deleting={deletingId === email.messageId}
                isTrash={isTrashFolder}
              />
            ))
          )}

          {error && !searchActive && (
            <p
              style={{ color: LIGHT.danger, fontSize: "0.8rem", padding: "0.75rem" }}
            >
              {error}
            </p>
          )}

          {!searchActive && !reachedEnd && emails.length > 0 && (
            <div style={{ padding: "0.75rem", textAlign: "center" }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                style={{
                  padding: "0.45rem 1.2rem",
                  borderRadius: 8,
                  border: `1px solid ${LIGHT.border}`,
                  background: LIGHT.panel,
                  color: LIGHT.accent,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: loading ? "default" : "pointer",
                }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* READING PANE */}
      <div style={{ overflowY: "auto", minHeight: 0, background: LIGHT.panel }}>
        {!selectedEmail ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: LIGHT.textMuted,
              gap: "0.5rem",
              padding: "2rem",
            }}
          >
            <span style={{ fontSize: "2.5rem" }}>✉️</span>
            <span style={{ fontSize: "0.9rem" }}>Select an email to read</span>
          </div>
        ) : (
          <ReadingPane
            key={selectedEmail.messageId}
            email={selectedEmail}
            detail={details[selectedEmail.messageId]}
            accountId={accountId}
            folderId={selectedEmail.folderId ?? folderId}
            isDraftsFolder={isDraftsFolder}
            isTrashFolder={isTrashFolder}
            deleting={deletingId === selectedEmail.messageId}
            onDelete={() => deleteEmail(selectedEmail.messageId, selectedEmail.folderId)}
            onRestore={() => restoreEmail(selectedEmail.messageId)}
            onRemove={() => dropEmail(selectedEmail.messageId)}
          />
        )}
      </div>
      </div>
    </div>
  );
}

function deepLinkHeaderValue(header: string, name: string): string {
  const match = header.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

/* ───────────────────────── List row ───────────────────────── */

function EmailRow({
  email,
  selected,
  onSelect,
  onDelete,
  deleting,
  isTrash,
}: {
  email: EmailItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
  isTrash: boolean;
}) {
  const sender = email.senderName || email.from || "Unknown";
  return (
    <div
      className="email-row"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        position: "relative",
        display: "flex",
        gap: "0.65rem",
        padding: "0.6rem 0.85rem",
        cursor: "pointer",
        borderBottom: `1px solid ${LIGHT.border}`,
        borderLeft: `3px solid ${selected ? LIGHT.accent : "transparent"}`,
        background: selected ? LIGHT.selected : "transparent",
      }}
    >
      {/* Hover-reveal delete button (no need to open the email first) */}
      <button
        type="button"
        className="email-del"
        title={isTrash ? "Delete forever" : "Move to Trash"}
        aria-label={isTrash ? "Delete forever" : "Move to Trash"}
        disabled={deleting}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          border: `1px solid ${LIGHT.border}`,
          background: LIGHT.panel,
          color: LIGHT.danger,
          fontSize: "0.8rem",
          lineHeight: 1,
          cursor: deleting ? "default" : "pointer",
          ...(deleting ? { opacity: 1 } : {}),
        }}
      >
        {deleting ? (
          <span className="spinner" style={{ width: 13, height: 13 }} />
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        )}
      </button>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: avatarGradient(email.from || sender),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {initials(sender)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.85rem",
              color: LIGHT.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sender}
          </span>
          <span
            style={{
              color: LIGHT.textMuted,
              fontSize: "0.72rem",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {email.receivedAtLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: "0.83rem",
            color: LIGHT.text,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: "0.1rem",
          }}
        >
          {email.subject}
        </div>
        <div
          style={{
            fontSize: "0.72rem",
            color: LIGHT.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: "0.12rem",
          }}
        >
          From: <span style={{ color: LIGHT.textSecondary }}>{email.from || "—"}</span>
          {email.to && (
            <>
              {"  ·  To: "}
              <span style={{ color: LIGHT.textSecondary }}>{email.to}</span>
            </>
          )}
        </div>
        {email.summary && (
          <div
            style={{
              fontSize: "0.78rem",
              color: LIGHT.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: "0.05rem",
            }}
          >
            {email.summary}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Reading pane ─────────────────────── */

/* ───────────── Conversation thread (replies below the message) ───────────── */

interface ThreadMessage {
  messageId: string;
  folderId: string;
  from: string;
  senderName: string;
  to: string;
  subject: string;
  receivedAt: string;
  isOwn: boolean;
  content: string;
}

/**
 * Fetches the OTHER messages in the opened email's conversation (the app's
 * message route returns only the single clicked message) and renders them
 * beneath it — so a reply saved in Sent shows up under the inbox email.
 * Renders nothing while loading or when the thread has no other messages.
 */
function ConversationThread({
  accountId,
  folderId,
  messageId,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    const params = new URLSearchParams({ folderId, messageId });
    if (accountId) params.set("accountId", accountId);
    fetch(`/api/zoho/thread?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMessages(Array.isArray(d.messages) ? d.messages : []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, folderId, messageId]);

  // Show only the reply/replies WE sent — not a duplicate of the original email
  // (already rendered above in the reading pane) and no section header.
  const replies = messages.filter((m) => m.isOwn);
  if (replies.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "1.25rem",
        borderTop: `1px solid ${LIGHT.border}`,
        paddingTop: "1rem",
      }}
    >
      {replies.map((m) => (
        <ThreadMessageCard key={m.messageId} message={m} accountId={accountId} />
      ))}
    </div>
  );
}

/** Two-letter initials for the avatar (first + last word of the name). */
function threadInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
}

/** Splits a reply's HTML into its new text and the trimmed quoted history. */
function splitQuotedHtml(html: string): { body: string; quoted: string } {
  const markers = [
    /-{2,}\s*On\b[\s\S]{0,300}?wrote\s*-{2,}/i, // Zoho "---- On <date> X wrote ----"
    /\bOn\b[\s\S]{0,200}?\bwrote:/i, // Gmail "On <date> X wrote:"
    /<blockquote/i,
    /-{2,}\s*Original Message\s*-{2,}/i, // Outlook
  ];
  let idx = -1;
  for (const re of markers) {
    const m = html.match(re);
    if (m && m.index != null && (idx === -1 || m.index < idx)) idx = m.index;
  }
  if (idx <= 0) return { body: html, quoted: "" };
  return { body: html.slice(0, idx), quoted: html.slice(idx) };
}

/**
 * A single message in the conversation, styled like Zoho/Gmail: an avatar +
 * sender + date header, the new message text, and the quoted history collapsed
 * behind a "•••" toggle (instead of dumping the whole raw thread).
 */
function ThreadMessageCard({
  message,
  accountId,
}: {
  message: ThreadMessage;
  accountId: string;
}) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { body, quoted } = splitQuotedHtml(message.content);
  const name = message.senderName || message.from || "Unknown";

  return (
    <div
      style={{
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 12,
        padding: "0.85rem 1rem",
        marginBottom: "0.7rem",
        background: LIGHT.panel,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "0.6rem",
        }}
      >
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: LIGHT.accent,
            color: "#fff",
            fontSize: "0.78rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {threadInitials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: LIGHT.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          {message.to && (
            <div
              style={{
                fontSize: "0.72rem",
                color: LIGHT.textMuted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              to {message.to}
            </div>
          )}
        </div>
        <div style={{ fontSize: "0.72rem", color: LIGHT.textMuted, whiteSpace: "nowrap" }}>
          {new Date(message.receivedAt).toLocaleString()}
        </div>
      </div>

      <EmailBody
        html={body}
        attachments={[]}
        ids={{ accountId, folderId: message.folderId, messageId: message.messageId }}
      />

      {quoted && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setShowQuoted((v) => !v)}
            title={showQuoted ? "Hide quoted text" : "Show quoted text"}
            style={{
              border: `1px solid ${LIGHT.border}`,
              background: LIGHT.panelAlt,
              color: LIGHT.textSecondary,
              borderRadius: 6,
              padding: "0.05rem 0.5rem",
              fontSize: "0.9rem",
              lineHeight: 1.4,
              cursor: "pointer",
            }}
          >
            •••
          </button>
          {showQuoted && (
            <div
              style={{
                marginTop: "0.5rem",
                paddingLeft: "0.8rem",
                borderLeft: `2px solid ${LIGHT.border}`,
                color: LIGHT.textSecondary,
              }}
            >
              <EmailBody
                html={quoted}
                attachments={[]}
                ids={{ accountId, folderId: message.folderId, messageId: message.messageId }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ParentMsg {
  messageId: string;
  folderId: string;
  from: string;
  senderName: string;
  to: string;
  subject: string;
  receivedAt: string;
  content: string;
}

/**
 * When viewing a DRAFT, shows the original email it replies to (fetched via
 * /api/zoho/parent) so it's clear which incoming message the draft answers.
 * Renders nothing while there's no resolvable parent (e.g. a from-scratch draft).
 */
function DraftParentEmail({
  accountId,
  folderId,
  messageId,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
}) {
  const [parent, setParent] = useState<ParentMsg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setParent(null);
    const params = new URLSearchParams({ folderId, messageId });
    if (accountId) params.set("accountId", accountId);
    fetch(`/api/zoho/parent?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setParent(d.parent ?? null);
      })
      .catch(() => {
        if (!cancelled) setParent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, folderId, messageId]);

  if (loading) {
    return (
      <div
        style={{
          fontSize: "0.8rem",
          color: LIGHT.textMuted,
          marginBottom: "0.9rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span className="spinner" style={{ width: 12, height: 12 }} /> Loading
        original email…
      </div>
    );
  }
  if (!parent) return null;

  const name = parent.senderName || parent.from || "Unknown";
  return (
    <div
      style={{
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 12,
        marginBottom: "1rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.6rem 0.85rem",
          background: LIGHT.panelAlt,
          borderBottom: `1px solid ${LIGHT.border}`,
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <span
          style={{
            fontSize: "0.66rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: LIGHT.textMuted,
            flexShrink: 0,
          }}
        >
          Replying to
        </span>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: avatarGradient(parent.from || name),
            color: "#fff",
            fontSize: "0.64rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {initials(name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: LIGHT.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
            {parent.from && parent.from !== name && (
              <span style={{ color: LIGHT.textMuted, fontWeight: 400, marginLeft: 6 }}>
                {parent.from}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              color: LIGHT.textMuted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {parent.subject} · {new Date(parent.receivedAt).toLocaleString()}
          </div>
        </div>
      </div>
      <div style={{ padding: "0.6rem 0.85rem" }}>
        <EmailBody
          html={parent.content}
          attachments={[]}
          ids={{ accountId, folderId: parent.folderId, messageId: parent.messageId }}
        />
      </div>
    </div>
  );
}

function ReadingPane({
  email,
  detail,
  accountId,
  folderId,
  isDraftsFolder,
  isTrashFolder,
  deleting,
  onDelete,
  onRestore,
  onRemove,
}: {
  email: EmailItem;
  detail?: MessageDetailState;
  accountId: string;
  folderId: string;
  isDraftsFolder: boolean;
  isTrashFolder: boolean;
  deleting: boolean;
  onDelete: () => void;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const sender = email.senderName || email.from || "Unknown";
  const [autoReplyOpen, setAutoReplyOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {autoReplyOpen && (
        <AutoReplyModal
          accountId={accountId}
          folderId={folderId}
          messageId={email.messageId}
          onClose={() => setAutoReplyOpen(false)}
        />
      )}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: `1px solid ${LIGHT.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              color: LIGHT.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {email.subject}
          </h2>
          <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
            {isTrashFolder && (
              <button
                type="button"
                onClick={onRestore}
                disabled={deleting}
                title="Restore to Inbox"
                style={iconBtn(LIGHT.textSecondary)}
              >
                ♻️
              </button>
            )}
            {!isDraftsFolder && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                title={isTrashFolder ? "Delete forever" : "Delete"}
                style={iconBtn(LIGHT.danger)}
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            marginTop: "0.7rem",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: avatarGradient(email.from || sender),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initials(sender)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{ fontSize: "0.86rem", fontWeight: 600, color: LIGHT.text }}
            >
              {sender}
              {email.from && email.from !== email.senderName && (
                <span
                  style={{
                    color: LIGHT.textMuted,
                    fontWeight: 400,
                    marginLeft: "0.4rem",
                    fontSize: "0.78rem",
                  }}
                >
                  {email.from}
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.74rem", color: LIGHT.textMuted }}>
              {email.receivedAtLabel}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "1.1rem 1.25rem", flex: 1 }}>
        {detail?.loading && (
          <Loader label="Loading message…" style={{ color: LIGHT.textSecondary }} />
        )}
        {detail?.error && (
          <p style={{ color: LIGHT.danger, fontSize: "0.85rem" }}>
            Could not load message: {detail.error}
          </p>
        )}
        {detail?.data &&
          (isDraftsFolder ? (
            /* Drafts → show the original email this draft replies to (so you know
               who it's for), then the editable composer. */
            <>
              <DraftParentEmail
                accountId={accountId}
                folderId={folderId}
                messageId={email.messageId}
              />
              <DraftReply
                accountId={accountId}
                folderId={folderId}
                messageId={email.messageId}
                isDraft
                initialText={detail.data.content}
                onRemove={onRemove}
              />
            </>
          ) : (
            <>
              {detail.data.classification && (
                <CategoryBadge classification={detail.data.classification} />
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setAutoReplyOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.5rem 1.1rem",
                    borderRadius: 8,
                    border: "none",
                    background: LIGHT.accent,
                    color: "#fff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ⚡ Auto Reply
                </button>

                {detail.data.unsubscribe && (
                  <UnsubscribeButton
                    accountId={accountId}
                    folderId={folderId}
                    messageId={email.messageId}
                    sender={sender}
                    unsub={detail.data.unsubscribe}
                  />
                )}

                {email.from && (
                  <BlockSenderButton
                    accountId={accountId}
                    folderId={folderId}
                    messageId={email.messageId}
                    senderEmail={email.from}
                    onBlocked={onRemove}
                  />
                )}
              </div>

              {(detail.data.attachments ?? []).some((a) => !a.isInline) && (
                <Attachments
                  accountId={accountId}
                  folderId={folderId}
                  messageId={email.messageId}
                  attachments={(detail.data.attachments ?? []).filter(
                    (a) => !a.isInline
                  )}
                />
              )}

              <EmailBody
                html={detail.data.content}
                attachments={detail.data.attachments ?? []}
                ids={{ accountId, folderId, messageId: email.messageId }}
              />

              {/* Rest of the conversation (e.g. the auto-reply saved in Sent). */}
              <ConversationThread
                accountId={accountId}
                folderId={folderId}
                messageId={email.messageId}
              />

              {detail.data.header && (
                <details style={{ marginTop: "0.75rem" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      color: LIGHT.textMuted,
                      fontSize: "0.78rem",
                    }}
                  >
                    Raw headers
                  </summary>
                  <pre
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.75rem",
                      background: LIGHT.panelAlt,
                      border: `1px solid ${LIGHT.border}`,
                      borderRadius: 8,
                      fontSize: "0.72rem",
                      color: LIGHT.textSecondary,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {detail.data.header}
                  </pre>
                </details>
              )}
            </>
          ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Attachments ─────────────────────── */

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function fileIcon(name: string): string {
  if (IMAGE_EXT.test(name)) return "🖼️";
  if (/\.pdf$/i.test(name)) return "📕";
  if (/\.(docx?|odt|rtf)$/i.test(name)) return "📄";
  if (/\.(xlsx?|csv|ods)$/i.test(name)) return "📊";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "🗜️";
  return "📎";
}

/** Identifiers needed to build an attachment proxy URL. */
interface AttachmentIds {
  accountId: string;
  folderId: string;
  messageId: string;
}

/** Builds the `/api/zoho/attachment` URL for one attachment (inline or download). */
function attachmentUrl(
  ids: AttachmentIds,
  att: EmailAttachment,
  inline: boolean
): string {
  const params = new URLSearchParams({
    accountId: ids.accountId,
    folderId: ids.folderId,
    messageId: ids.messageId,
    attachmentId: att.attachmentId,
    name: att.attachmentName,
  });
  if (inline) params.set("inline", "1");
  return `/api/zoho/attachment?${params.toString()}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const normalizeCid = (cid: string) =>
  cid.replace(/^<|>$/g, "").trim().toLowerCase();

/**
 * Rewrites inline-image references in an email body so they actually render.
 *
 * Zoho serves inline images through its OWN authenticated URL
 * (`src="/mail/ImageDisplay?…&cid=<content-id>&…"`), which is relative and would
 * hit our server (404) inside the iframe. We rewrite each such src — matched to
 * the inline attachment by its `cid` — to our `/api/zoho/attachment` proxy.
 * A plain RFC `cid:<content-id>` scheme (other mail clients) is handled too.
 * Non-matching HTML is left untouched.
 */
function resolveInlineImages(
  html: string,
  attachments: EmailAttachment[],
  ids: AttachmentIds
): string {
  const inline = attachments.filter((a) => a.isInline && a.cid);
  if (inline.length === 0) return html;

  const byCid = new Map<string, EmailAttachment>();
  for (const a of inline) byCid.set(normalizeCid(a.cid ?? ""), a);

  let out = html;

  // 1) Zoho's inline scheme: src="/mail/ImageDisplay?...&cid=CID&...".
  out = out.replace(
    /src=(["'])([^"']*ImageDisplay[^"']*)\1/gi,
    (whole, quote: string, url: string) => {
      // The `&` may be HTML-encoded as `&amp;` in the attribute value.
      const m = url.match(/cid=([^&"']+)/i);
      const att = m ? byCid.get(normalizeCid(decodeURIComponent(m[1]))) : undefined;
      return att ? `src=${quote}${attachmentUrl(ids, att, true)}${quote}` : whole;
    }
  );

  // 2) Standard RFC cid: references, e.g. src="cid:CID".
  for (const att of inline) {
    const cid = (att.cid ?? "").replace(/^<|>$/g, "").trim();
    if (!cid) continue;
    out = out.replace(
      new RegExp(`cid:${escapeRegExp(cid)}`, "gi"),
      attachmentUrl(ids, att, true)
    );
  }

  return out;
}

function Attachments({
  accountId,
  folderId,
  messageId,
  attachments,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
  attachments: EmailAttachment[];
}) {
  const buildUrl = (att: EmailAttachment, inline: boolean) =>
    attachmentUrl({ accountId, folderId, messageId }, att, inline);

  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <div
        style={{
          color: LIGHT.textMuted,
          fontSize: "0.7rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {attachments.map((att) => {
          const isImage = IMAGE_EXT.test(att.attachmentName);
          return (
            <a
              key={att.attachmentId}
              href={buildUrl(att, false)}
              download={att.attachmentName}
              title={`Download ${att.attachmentName}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.45rem 0.7rem",
                borderRadius: 8,
                border: `1px solid ${LIGHT.border}`,
                background: LIGHT.panelAlt,
                maxWidth: 240,
                textDecoration: "none",
              }}
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={buildUrl(att, true)}
                  alt={att.attachmentName}
                  style={{
                    width: 34,
                    height: 34,
                    objectFit: "cover",
                    borderRadius: 5,
                    flexShrink: 0,
                    background: LIGHT.border,
                  }}
                />
              ) : (
                <span style={{ fontSize: "1.25rem" }}>
                  {fileIcon(att.attachmentName)}
                </span>
              )}
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    color: LIGHT.text,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {att.attachmentName || "attachment"}
                </span>
                <span style={{ color: LIGHT.textMuted, fontSize: "0.7rem" }}>
                  {formatBytes(att.attachmentSize)} · ⬇
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── Reply composer ─────────────────────── */

function DraftReply({
  accountId,
  folderId,
  messageId,
  isDraft = false,
  initialText = "",
  onRemove,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
  isDraft?: boolean;
  initialText?: string;
  onRemove?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [text, setText] = useState(initialText);
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [generated, setGenerated] = useState(isDraft);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function call(
    action: "generate" | "save" | "send" | "delete" | "meta",
    extra: Record<string, unknown> = {}
  ) {
    const res = await fetch("/api/zoho/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        folderId,
        messageId,
        action,
        text,
        context: isDraft ? "draft" : "reply",
        ...extra,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      replyText?: string;
      to?: string;
      from?: string;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? `Request failed (${res.status})`);
    }
    return data;
  }

  // For an existing draft we don't regenerate, so fetch its From/To on open so
  // the user can see who it's addressed to before hitting Send.
  useEffect(() => {
    if (!isDraft) return;
    let cancelled = false;
    call("meta")
      .then((data) => {
        if (cancelled) return;
        setTo(data.to ?? "");
        setFrom(data.from ?? "");
      })
      .catch(() => {
        /* non-fatal: header lookup failed, box still works */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    setError(null);
    try {
      const data = await call("generate");
      setText(plainToHtml(data.replyText ?? ""));
      setTo(data.to ?? "");
      setFrom(data.from ?? "");
      setGenerated(true);
    } catch (e) {
      setGenError(errMsg(e));
      toast.error(`Draft failed: ${errMsg(e)}`);
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    const label = isDraft ? "draft" : "reply";
    const ok = await confirm({
      title: "Send email?",
      message: `This ${label} will be sent${to ? ` to ${to}` : ""}.`,
      confirmLabel: "Send",
    });
    if (!ok) return;
    setSending(true);
    setError(null);
    try {
      await call("send");
      setSent(true);
      toast.success(isDraft ? "Draft sent" : `Reply sent to ${to}`);
      if (isDraft) onRemove?.();
    } catch (e) {
      setError(errMsg(e));
      toast.error(`Send failed: ${errMsg(e)}`);
    } finally {
      setSending(false);
    }
  }

  async function del() {
    const ok = await confirm({
      title: "Delete draft?",
      message: "This draft will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await call("delete", { expunge: true });
      toast.success("Draft deleted permanently");
      onRemove?.();
    } catch (e) {
      setError(errMsg(e));
      toast.error(`Delete failed: ${errMsg(e)}`);
    } finally {
      setDeleting(false);
    }
  }

  if (sent) {
    return (
      <div style={statusBox(LIGHT.success, LIGHT.successSoft)}>
        ✓ Reply sent to {to}
      </div>
    );
  }

  if (!generated) {
    return (
      <div style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          style={primaryBtn(generating)}
        >
          {generating ? (
            <>
              <span className="spinner" /> Drafting…
            </>
          ) : (
            "✍️ Draft reply"
          )}
        </button>
        {genError && <ErrorLine msg={genError} />}
      </div>
    );
  }

  const busy = sending || generating || deleting;
  return (
    <div
      style={{
        marginBottom: "1.1rem",
        padding: "0.9rem 1rem",
        borderRadius: 10,
        border: `1px solid ${LIGHT.accent}`,
        background: LIGHT.accentSoft,
      }}
    >
      <div
        style={{
          fontSize: "0.78rem",
          marginBottom: "0.6rem",
          paddingBottom: "0.55rem",
          borderBottom: `1px solid ${LIGHT.border}`,
          lineHeight: 1.7,
        }}
      >
        <div style={{ color: LIGHT.textSecondary, fontWeight: 600, marginBottom: "0.15rem" }}>
          {isDraft ? "Edit draft" : "Reply"}
        </div>
        {from && (
          <div style={{ color: LIGHT.textSecondary }}>
            From: <strong style={{ color: LIGHT.text }}>{from}</strong>
          </div>
        )}
        <div style={{ color: LIGHT.textSecondary }}>
          To: <strong style={{ color: LIGHT.text }}>{to || "…"}</strong>
        </div>
      </div>

      <RichEditor value={text} onChange={setText} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginTop: "0.6rem",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={send}
          disabled={busy || !text.trim()}
          style={primaryBtn(busy || !text.trim())}
        >
          {sending ? (
            <>
              <span className="spinner" /> Sending…
            </>
          ) : (
            "✈️ Send"
          )}
        </button>
        {isDraft && (
          <button
            type="button"
            onClick={del}
            disabled={busy}
            style={{
              ...secondaryBtn(busy),
              color: LIGHT.danger,
              borderColor: "#f3c2c2",
              marginLeft: "auto",
            }}
          >
            {deleting ? "Deleting…" : "🗑️ Delete"}
          </button>
        )}
      </div>

      {error && <ErrorLine msg={error} />}
    </div>
  );
}

/* ─────────────────────── Email body ─────────────────────── */

/** Base styling injected into the sandboxed iframe so emails read cleanly. */
function wrapEmail(html: string): string {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);
  const body = looksLikeHtml
    ? html
    : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${html}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      font-size:14px;line-height:1.55;color:#1f2733;margin:0;padding:10px;
      word-break:break-word;}
    img{max-width:100%;height:auto}
    a{color:#2563eb}
    blockquote{margin:0 0 0 8px;padding-left:10px;border-left:2px solid #e4e7ec;color:#5c6672}
  </style></head><body>${body}</body></html>`;
}

/**
 * Splits an email's HTML into the new content and the quoted reply history.
 * Best-effort: matches common quote markers, and only splits when the marker
 * appears past the first bit of content (so it never hides the whole email).
 */
function splitQuoted(html: string): { main: string; quoted: string | null } {
  const markers: RegExp[] = [
    /<blockquote/i,
    /class="[^"]*gmail_quote/i,
    /-{2,}\s*original message\s*-{2,}/i,
    /<div[^>]+class="[^"]*(zmail_extra|zm_)[^"]*"/i,
    /On\s.{0,90}?\swrote:/i,
    /<div[^>]*>\s*(from|von|de)\s*:\s*<?[^\s@<]+@/i,
  ];
  let idx = -1;
  for (const re of markers) {
    const m = html.match(re);
    if (m && m.index != null && m.index > 150) {
      idx = idx === -1 ? m.index : Math.min(idx, m.index);
    }
  }
  if (idx === -1) return { main: html, quoted: null };
  return { main: html.slice(0, idx), quoted: html.slice(idx) };
}

/**
 * A sandboxed email-body iframe that auto-sizes to its rendered content, so a
 * short message doesn't leave a tall empty box.
 *
 * `sandbox="allow-same-origin"` (WITHOUT allow-scripts) keeps email JavaScript
 * from running while still letting the parent read the document height to size
 * the frame. Height is re-measured once images finish loading.
 */
function EmailFrame({
  html,
  title,
  style,
}: {
  html: string;
  title: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  const resize = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    const measure = () => {
      const h = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0
      );
      // Small buffer avoids a spurious inner scrollbar; cap guards huge emails.
      if (h > 0) setHeight(Math.min(Math.max(h + 8, 60), 4000));
    };
    measure();
    // Images load after the document does — re-measure as each one arrives.
    for (const img of Array.from(doc.images ?? [])) {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    }
  }, []);

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={wrapEmail(html)}
      onLoad={resize}
      style={{
        width: "100%",
        height,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 8,
        background: "#fff",
        ...style,
      }}
    />
  );
}

/** Renders the message body, trimming the quoted history behind a toggle. */
function EmailBody({
  html,
  attachments,
  ids,
}: {
  html: string;
  attachments?: EmailAttachment[];
  ids?: AttachmentIds;
}) {
  const [showQuoted, setShowQuoted] = useState(true);
  // Resolve inline `cid:` images to real URLs so they render in place.
  const resolved =
    attachments && ids ? resolveInlineImages(html, attachments, ids) : html;
  const { main, quoted } = splitQuoted(resolved);

  return (
    <div>
      <EmailFrame title="email-body" html={main} />

      {quoted && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setShowQuoted((v) => !v)}
            style={{
              border: "none",
              background: LIGHT.panelAlt,
              color: LIGHT.textSecondary,
              borderRadius: 6,
              padding: "0.15rem 0.6rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            {showQuoted ? "Hide quoted text" : "··· Show quoted text"}
          </button>
          {showQuoted && (
            <EmailFrame
              title="email-quoted"
              html={quoted}
              style={{ marginTop: "0.5rem" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── shared bits ─────────────────────── */

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-all"
      style={{
        flexShrink: 0,
        padding: "0.25rem 0.7rem",
        borderRadius: 999,
        fontSize: "0.74rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: "pointer",
        border: `1px solid ${active ? (color ?? LIGHT.accent) : LIGHT.border}`,
        background: active ? (color ?? LIGHT.accent) : LIGHT.panel,
        color: active ? "#fff" : LIGHT.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

function CategoryBadge({
  classification,
}: {
  classification: EmailClassification;
}) {
  const colors = CATEGORY_COLORS[classification.category];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "0.85rem",
        flexWrap: "wrap",
      }}
    >
      <span
        title={classification.reason}
        style={{
          padding: "0.22rem 0.65rem",
          borderRadius: 999,
          fontSize: "0.72rem",
          fontWeight: 700,
          background: colors.bg,
          color: colors.fg,
        }}
      >
        {classification.label}
      </span>
      <span style={{ color: LIGHT.textMuted, fontSize: "0.7rem" }}>
        AI · {Math.round(classification.confidence * 100)}% confident
      </span>
    </div>
  );
}

/**
 * Unsubscribe button shown when the opened email advertises List-Unsubscribe.
 *
 * A plain web link (not one-click) simply opens in a new tab — the user finishes
 * on the sender's page. RFC 8058 one-click and mailto-only targets are performed
 * server-side (POST /api/zoho/unsubscribe) after a confirm, since they fire an
 * outbound request / send an email on the user's behalf.
 */
function UnsubscribeButton({
  accountId,
  folderId,
  messageId,
  sender,
  unsub,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
  sender: string;
  unsub: UnsubscribeInfo;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handle() {
    // Plain web link → open the sender's unsubscribe page in a new tab.
    if (unsub.url && !unsub.oneClick) {
      window.open(unsub.url, "_blank", "noopener,noreferrer");
      return;
    }

    // One-click or mailto → this sends a request on the user's behalf; confirm.
    const ok = await confirm({
      title: "Unsubscribe?",
      message: `Send an unsubscribe request to ${sender}? You should stop receiving these emails.`,
      confirmLabel: "Unsubscribe",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/zoho/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, folderId, messageId }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        method?: string;
        openUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      // Server may hand back a plain link to open (non one-click web URL).
      if (data.method === "link" && data.openUrl) {
        window.open(data.openUrl, "_blank", "noopener,noreferrer");
      }
      setDone(true);
      toast.success("Unsubscribe request sent.");
    } catch (e) {
      toast.error(
        `Unsubscribe failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy || done}
      title="Unsubscribe from this sender"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.5rem 1rem",
        borderRadius: 8,
        border: `1px solid ${LIGHT.border}`,
        background: LIGHT.panel,
        color: done ? LIGHT.success : LIGHT.textSecondary,
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: busy || done ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {done ? (
        "✓ Unsubscribed"
      ) : busy ? (
        <>
          <span className="spinner" /> Unsubscribing…
        </>
      ) : (
        "🚫 Unsubscribe"
      )}
    </button>
  );
}

/**
 * Blocks a sender: future emails from them are auto-moved to Spam and never
 * auto-replied (webhook checks the blocklist), and the current email is moved to
 * Spam now. On success the message is dropped from the open list.
 */
function BlockSenderButton({
  accountId,
  folderId,
  messageId,
  senderEmail,
  onBlocked,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
  senderEmail: string;
  onBlocked?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function handle() {
    const ok = await confirm({
      title: "Block sender?",
      message: `Block ${senderEmail}? Future emails from them will be moved to the Filtered folder and never get an auto-reply. This email will be moved there now.`,
      confirmLabel: "Block sender",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/zoho/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: senderEmail, accountId, folderId, messageId }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      toast.success(`Blocked ${senderEmail} — moved to Filtered`);
      onBlocked?.();
    } catch (e) {
      toast.error(
        `Block failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      title={`Block ${senderEmail} and stop future emails`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.5rem 1rem",
        borderRadius: 8,
        border: `1px solid ${LIGHT.dangerSoft}`,
        background: LIGHT.dangerSoft,
        color: LIGHT.danger,
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <>
          <span className="spinner" /> Blocking…
        </>
      ) : (
        "🚫 Block sender"
      )}
    </button>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p style={{ marginTop: "0.5rem", color: LIGHT.danger, fontSize: "0.8rem" }}>
      {msg}
    </p>
  );
}

function iconBtn(color: string): CSSProperties {
  return {
    border: "none",
    background: "transparent",
    color,
    cursor: "pointer",
    fontSize: "0.95rem",
    padding: "0.25rem 0.4rem",
    borderRadius: 6,
    lineHeight: 1,
  };
}

const searchNotice: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.45rem",
  color: LIGHT.textMuted,
  fontSize: "0.85rem",
  padding: "1.5rem",
  textAlign: "center",
};

function primaryBtn(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.45rem 1rem",
    borderRadius: 8,
    border: "none",
    background: LIGHT.accent,
    color: "#fff",
    fontSize: "0.83rem",
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function secondaryBtn(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.45rem 0.85rem",
    borderRadius: 8,
    border: `1px solid ${LIGHT.border}`,
    background: LIGHT.panel,
    color: LIGHT.text,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function statusBox(fg: string, bg: string): CSSProperties {
  return {
    marginBottom: "1rem",
    padding: "0.7rem 1rem",
    borderRadius: 8,
    border: `1px solid ${fg}`,
    background: bg,
    color: fg,
    fontWeight: 600,
    fontSize: "0.86rem",
  };
}
