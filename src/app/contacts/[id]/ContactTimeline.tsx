"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  ContactTimelineItem,
  ContactTimelineKind,
} from "../../../lib/repositories/contact-timeline";
import { LIGHT } from "../../zoho/_components/ui";

type Filter = "all" | ContactTimelineKind | "email";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "email", label: "Emails" },
  { id: "task", label: "Tasks" },
  { id: "deal", label: "Deals" },
  { id: "meeting", label: "Meetings" },
];

export function ContactTimeline({
  items,
  counts,
}: {
  items: ContactTimelineItem[];
  counts: {
    emails: number;
    tasks: number;
    meetings: number;
    deals: number;
  };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "email") {
      return items.filter(
        (it) => it.kind === "email-in" || it.kind === "email-out"
      );
    }
    return items.filter((it) => it.kind === filter);
  }, [filter, items]);

  const filterCount = (id: Filter): number => {
    if (id === "all") return items.length;
    if (id === "email") return counts.emails;
    if (id === "task") return counts.tasks;
    if (id === "deal") return counts.deals;
    return counts.meetings;
  };

  return (
    <section>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.85rem",
        }}
      >
        <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: LIGHT.text, margin: 0 }}>
          Timeline{" "}
          <span style={{ color: LIGHT.textMuted, fontWeight: 600 }}>
            · {filtered.length}
          </span>
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const n = filterCount(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                style={{
                  border: `1px solid ${active ? LIGHT.accent : LIGHT.border}`,
                  background: active ? LIGHT.accentSoft : LIGHT.panel,
                  color: active ? LIGHT.accent : LIGHT.textSecondary,
                  borderRadius: 999,
                  padding: "0.28rem 0.65rem",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label}
                {n > 0 ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: LIGHT.textMuted, fontSize: "0.88rem", margin: 0 }}>
          No {filter === "all" ? "activity" : FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} yet.
          Emails, tasks, deals, and meetings appear here as they come in.
        </p>
      ) : (
        <div style={{ position: "relative", paddingLeft: "1.5rem" }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 7,
              top: 6,
              bottom: 6,
              width: 2,
              background: LIGHT.border,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {filtered.map((it) => {
              const isOpen = expanded === it.id;
              return (
                <div key={it.id} style={{ position: "relative" }}>
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: -25,
                      top: 4,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: LIGHT.panel,
                      border: `2px solid ${dotColor(it.kind)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.55rem",
                    }}
                  >
                    {icon(it.kind)}
                  </span>
                  <article
                    style={{
                      background: LIGHT.panel,
                      border: `1px solid ${LIGHT.border}`,
                      borderRadius: 11,
                      padding: "0.7rem 0.9rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: dotColor(it.kind),
                          letterSpacing: "0.02em",
                        }}
                      >
                        {it.tag}
                        {it.kind === "deal" && it.stage ? (
                          <span style={dealStageBadge(it.stage)}>{nice(it.stage)}</span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: LIGHT.textMuted,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatWhen(it.date)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : it.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        margin: "0.2rem 0 0",
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: it.bodyText ? "pointer" : "default",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: LIGHT.text,
                        }}
                      >
                        {it.title}
                        {it.kind === "deal" && it.value != null ? (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: LIGHT.success,
                            }}
                          >
                            ${it.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        ) : null}
                      </div>
                      {it.snippet && !isOpen && (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: LIGHT.textSecondary,
                            marginTop: "0.25rem",
                            lineHeight: 1.5,
                          }}
                        >
                          {it.snippet}
                        </div>
                      )}
                    </button>

                    {it.meta && (
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: LIGHT.textMuted,
                          marginTop: "0.35rem",
                        }}
                      >
                        {it.meta}
                      </div>
                    )}

                    {isOpen && it.bodyText && (
                      <div
                        style={{
                          marginTop: "0.55rem",
                          paddingTop: "0.55rem",
                          borderTop: `1px solid ${LIGHT.border}`,
                          fontSize: "0.8rem",
                          color: LIGHT.textSecondary,
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {it.bodyText}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.55rem",
                        marginTop: "0.55rem",
                      }}
                    >
                      {it.bodyText && (
                        <ActionLink
                          onClick={() => setExpanded(isOpen ? null : it.id)}
                          label={isOpen ? "Collapse" : "Show full details"}
                        />
                      )}
                      {it.zohoUrl && (
                        <a
                          href={it.zohoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={actionLinkStyle}
                        >
                          Open in Zoho ↗
                        </a>
                      )}
                      {it.href && (
                        <Link href={it.href} style={actionLinkStyle}>
                          View in app →
                        </Link>
                      )}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ActionLink({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick} style={actionLinkStyle}>
      {label}
    </button>
  );
}

const actionLinkStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  fontSize: "0.74rem",
  fontWeight: 700,
  color: LIGHT.accent,
  cursor: "pointer",
  textDecoration: "none",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function nice(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

function icon(kind: ContactTimelineKind): string {
  if (kind === "email-in") return "📥";
  if (kind === "email-out") return "📤";
  if (kind === "task") return "✅";
  if (kind === "deal") return "💼";
  return "🗓️";
}

function dotColor(kind: ContactTimelineKind): string {
  if (kind === "email-in") return LIGHT.accent;
  if (kind === "email-out") return LIGHT.success;
  if (kind === "task") return "#c2620e";
  if (kind === "deal") return "#0f766e";
  return "#7c3aed";
}

function dealStageBadge(stage: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    NEW: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
    QUOTED: { bg: "#fff2e0", fg: "#c2620e" },
    WON: { bg: LIGHT.successSoft, fg: LIGHT.success },
    LOST: { bg: LIGHT.dangerSoft, fg: LIGHT.danger },
  };
  const c = map[stage] ?? map.NEW;
  return {
    marginLeft: "0.45rem",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: "0.12rem 0.45rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
  };
}
