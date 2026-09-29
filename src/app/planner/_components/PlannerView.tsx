"use client";

import { Suspense, useState, type CSSProperties } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../../_components/app-nav";
import { TasksIcon } from "../../_components/icons";
import { useIsMobile } from "../../_hooks/useIsMobile";
import { TasksPanel } from "./TasksPanel";
import { MeetingsPanel } from "./MeetingsPanel";
import type { TaskRow, MeetingRow } from "./types";

export type { TaskRow, MeetingRow } from "./types";

/** Tasks & Meetings page: section header, tab menu, and the two interactive panels. */

type Tab = "tasks" | "meetings";

export function PlannerView({
  tasks,
  meetings,
  teamMembers,
}: {
  tasks: TaskRow[];
  meetings: MeetingRow[];
  teamMembers: string[];
}) {
  const [tab, setTab] = useState<Tab>("tasks");
  const isMobile = useIsMobile(768);

  const TABS: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "tasks", label: "Tasks", icon: "📋", count: tasks.length },
    { key: "meetings", label: "Meetings", icon: "📅", count: meetings.length },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: APP_HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: LIGHT.appBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          padding: isMobile ? "0.65rem 0.85rem" : "0.8rem 1.25rem",
          background: LIGHT.panel,
          borderBottom: `1px solid ${LIGHT.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: isMobile ? 34 : 38,
            height: isMobile ? 34 : 38,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${LIGHT.accent}, #7c3aed)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <TasksIcon width={19} height={19} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: isMobile ? "0.95rem" : "1.05rem",
              fontWeight: 700,
              color: LIGHT.text,
            }}
          >
            Tasks &amp; Meetings
          </div>
          {!isMobile ? (
            <div style={{ fontSize: "0.75rem", color: LIGHT.textMuted }}>
              Action items extracted from your inbox
            </div>
          ) : null}
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          gap: "0.4rem",
          padding: isMobile ? "0.5rem 0.85rem" : "0.6rem 1.25rem",
          background: LIGHT.panelAlt,
          borderBottom: `1px solid ${LIGHT.border}`,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map(({ key, label, icon, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={tabStyle(active, isMobile)}
            >
              <span>{icon}</span>
              {label}
              <span style={tabCount(active)}>{count}</span>
            </button>
          );
        })}
      </nav>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: isMobile ? "0.85rem 0.75rem 1.25rem" : "1.5rem 1.25rem",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tab === "tasks" ? (
          <Suspense fallback={<div style={{ color: LIGHT.textMuted, fontSize: "0.9rem" }}>Loading tasks…</div>}>
            <TasksPanel tasks={tasks} teamMembers={teamMembers} />
          </Suspense>
        ) : (
          <MeetingsPanel meetings={meetings} />
        )}
      </main>
    </div>
  );
}

function tabStyle(active: boolean, isMobile: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: isMobile ? "0.45rem 0.85rem" : "0.5rem 1.1rem",
    borderRadius: 8,
    border: `1px solid ${active ? LIGHT.accent : LIGHT.border}`,
    background: active ? LIGHT.accent : LIGHT.panel,
    color: active ? "#fff" : LIGHT.textSecondary,
    fontSize: isMobile ? "0.82rem" : "0.88rem",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function tabCount(active: boolean): CSSProperties {
  return {
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "0.05rem 0.4rem",
    borderRadius: 999,
    background: active ? "rgba(255,255,255,0.25)" : LIGHT.hover,
    color: active ? "#fff" : LIGHT.textSecondary,
  };
}
