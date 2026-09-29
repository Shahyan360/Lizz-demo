import Link from "next/link";
import type { CSSProperties } from "react";
import { getOrCreateTenant } from "../../lib/tenant";
import { prisma } from "../../lib/prisma";
import { LIGHT, initials, avatarGradient } from "../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../_components/app-nav";

/**
 * /dashboard — the CRM home. A read-only overview built entirely from the
 * email-driven data: lead funnel, pipeline value, follow-ups due, upcoming
 * meetings, new leads, and a recent-activity feed.
 */
export const dynamic = "force-dynamic";

const CARD_SHADOW = "0 1px 2px rgba(16,24,40,0.04)";
const PURPLE = "#7c3aed";
const AMBER = "#c2620e";

const money = (v: number | null | undefined) =>
  `$${Math.round(v ?? 0).toLocaleString()}`;

export default async function DashboardPage() {
  const now = new Date();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const activitySince = new Date();
  activitySince.setDate(activitySince.getDate() - 13);
  activitySince.setHours(0, 0, 0, 0);

  const [
    contactStages,
    dealStages,
    openTaskCount,
    dueTasks,
    upcomingMeetings,
    recentEmails,
    newLeads,
    emailActivity,
  ] = await Promise.all([
    prisma.contact.groupBy({
      by: ["lifecycleStage"],
      _count: { _all: true },
    }),
    prisma.deal.groupBy({
      by: ["stage"],
      _count: { _all: true },
      _sum: { value: true },
    }),
    prisma.task.count({
      where: { status: { in: ["TODO", "IN_PROGRESS"] } },
    }),
    prisma.task.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lte: endOfToday },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { contact: { select: { id: true, name: true, email: true } } },
    }),
    prisma.meeting.findMany({
      where: {
        startTime: { gte: now },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      orderBy: { startTime: "asc" },
      take: 6,
      include: { contact: { select: { id: true, name: true, email: true } } },
    }),
    prisma.storedEmail.findMany({
      orderBy: { receivedAt: "desc" },
      take: 10,
      include: { contact: { select: { id: true, name: true } } },
    }),
    prisma.contact.findMany({
      where: { lifecycleStage: "NEW" },
      orderBy: { lastInteractionAt: "desc" },
      take: 6,
    }),
    prisma.storedEmail.findMany({
      where: { receivedAt: { gte: activitySince } },
      select: { receivedAt: true, direction: true },
    }),
  ]);

  const stageCount = (s: string) =>
    contactStages.find((c) => c.lifecycleStage === s)?._count._all ?? 0;
  const dealBy = (s: string) => dealStages.find((d) => d.stage === s);
  const dealCount = (s: string) => dealBy(s)?._count._all ?? 0;
  const dealValue = (s: string) => dealBy(s)?._sum.value ?? 0;

  const newLeadCount = stageCount("NEW");
  const activeCount = stageCount("ACTIVE");
  const customerCount = stageCount("CUSTOMER");
  const totalContacts = newLeadCount + activeCount + customerCount;

  const openDeals = dealCount("NEW") + dealCount("QUOTED");
  const openValue = dealValue("NEW") + dealValue("QUOTED");
  const wonValue = dealValue("WON");
  const wonCount = dealCount("WON");

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const funnel = [
    { label: "New", value: newLeadCount, color: LIGHT.accent, href: "/contacts?stage=NEW" },
    { label: "Active", value: activeCount, color: AMBER, href: "/contacts?stage=ACTIVE" },
    { label: "Customers", value: customerCount, color: LIGHT.success, href: "/contacts?stage=CUSTOMER" },
  ];

  const pipeline = [
    { label: "New", count: dealCount("NEW"), value: dealValue("NEW"), color: LIGHT.accent },
    { label: "Quoted", count: dealCount("QUOTED"), value: dealValue("QUOTED"), color: PURPLE },
    { label: "Won", count: dealCount("WON"), value: dealValue("WON"), color: LIGHT.success },
    { label: "Lost", count: dealCount("LOST"), value: dealValue("LOST"), color: LIGHT.textMuted },
  ];

  // Bucket the last 14 days of email into inbound/outbound counts per day.
  const activityDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    d.setHours(0, 0, 0, 0);
    return { key: d.toDateString(), label: String(d.getDate()), inbound: 0, outbound: 0 };
  });
  const activityByKey = new Map(activityDays.map((d) => [d.key, d]));
  for (const e of emailActivity) {
    const d = new Date(e.receivedAt);
    d.setHours(0, 0, 0, 0);
    const bucket = activityByKey.get(d.toDateString());
    if (!bucket) continue;
    if (e.direction === "INBOUND") bucket.inbound += 1;
    else bucket.outbound += 1;
  }
  const activityMax = Math.max(1, ...activityDays.map((d) => d.inbound + d.outbound));
  const activityTotal = activityDays.reduce((s, d) => s + d.inbound + d.outbound, 0);

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
        overflow: "auto",
      }}
    >
      <div style={{ maxWidth: 1650, width: "100%", margin: "0 auto", padding: "1.75rem 2rem 4rem", boxSizing: "border-box" }}>
        {/* Hero */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: LIGHT.textMuted }}>
            {dateLabel}
          </p>
          <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.55rem", fontWeight: 800, color: LIGHT.text, letterSpacing: "-0.02em" }}>
            {greeting}
          </h1>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.9rem", color: LIGHT.textSecondary }}>
            {totalContacts} contact{totalContacts === 1 ? "" : "s"} · {openDeals} open deal{openDeals === 1 ? "" : "s"} worth{" "}
            <strong style={{ color: LIGHT.text }}>{money(openValue)}</strong> · {openTaskCount} open task
            {openTaskCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Metric tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
            gap: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          <Metric icon="🌱" label="New leads" value={String(newLeadCount)} href="/contacts?stage=NEW" accent={LIGHT.accent} />
          <Metric icon="🔥" label="Active" value={String(activeCount)} href="/contacts?stage=ACTIVE" accent={AMBER} />
          <Metric icon="⭐" label="Customers" value={String(customerCount)} href="/contacts?stage=CUSTOMER" accent={LIGHT.success} />
          <Metric icon="💼" label="Open deals" value={String(openDeals)} sub={money(openValue)} href="/deals" accent={LIGHT.accent} />
          <Metric icon="🏆" label="Won" value={String(wonCount)} sub={money(wonValue)} href="/deals" accent={LIGHT.success} />
          <Metric icon="✅" label="Open tasks" value={String(openTaskCount)} href="/planner" accent={PURPLE} />
        </div>

        {/* Funnel + pipeline */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <Card>
            <CardHeader title="Contact mix" action={{ label: "View contacts", href: "/contacts" }} />
            {totalContacts === 0 ? (
              <Empty>No contacts yet.</Empty>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <Donut segments={funnel} total={totalContacts} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>
                  {funnel.map((f) => (
                    <Link
                      key={f.label}
                      href={f.href}
                      className="email-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        textDecoration: "none",
                        padding: "0.2rem 0.4rem",
                        margin: "0 -0.4rem",
                        borderRadius: 8,
                      }}
                    >
                      <span style={dot(f.color)} />
                      <span style={{ flex: 1, fontSize: "0.83rem", color: LIGHT.textSecondary }}>{f.label}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: LIGHT.text }}>{f.value}</span>
                      <span style={{ fontSize: "0.72rem", color: LIGHT.textMuted, width: 36, textAlign: "right" }}>
                        {Math.round((f.value / totalContacts) * 100)}%
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Pipeline" action={{ label: "Open board", href: "/deals" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.55rem" }}>
              {pipeline.map((p) => (
                <div
                  key={p.label}
                  style={{
                    padding: "0.6rem 0.5rem",
                    borderRadius: 10,
                    background: LIGHT.panelAlt,
                    border: `1px solid ${LIGHT.border}`,
                    borderTop: `3px solid ${p.color}`,
                  }}
                >
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: LIGHT.text, lineHeight: 1 }}>{p.count}</div>
                  <div style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: LIGHT.textMuted, margin: "0.2rem 0 0.15rem" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: p.color }}>{money(p.value)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Email activity chart */}
        <div style={{ marginBottom: "1rem" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: LIGHT.text }}>Email activity</h2>
              <span style={{ fontSize: "0.76rem", color: LIGHT.textMuted }}>last 14 days · {activityTotal} total</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.9rem" }}>
                <LegendItem color={LIGHT.accent} label="Inbound" />
                <LegendItem color={LIGHT.success} label="Outbound" />
              </div>
            </div>
            {activityTotal === 0 ? (
              <Empty>No email activity in the last 14 days.</Empty>
            ) : (
              <ActivityChart days={activityDays} max={activityMax} />
            )}
          </Card>
        </div>

        {/* Lists */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1rem",
          }}
        >
          {/* Follow-ups due */}
          <Card>
            <CardHeader title="Follow-ups due" count={dueTasks.length} accent={AMBER} action={{ label: "All tasks", href: "/planner" }} />
            {dueTasks.length === 0 ? (
              <Empty>Nothing due — you're all caught up. 🎉</Empty>
            ) : (
              <List>
                {dueTasks.map((t) => (
                  <Row key={t.id}>
                    <span style={dot(AMBER)} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={rowTitle}>{t.title}</span>
                      {t.contact && (
                        <ContactLink id={t.contact.id} label={t.contact.name || t.contact.email} />
                      )}
                    </span>
                    <span style={rowMeta}>{t.dueDate ? t.dueDate.toLocaleDateString() : ""}</span>
                  </Row>
                ))}
              </List>
            )}
          </Card>

          {/* Upcoming meetings */}
          <Card>
            <CardHeader title="Upcoming meetings" count={upcomingMeetings.length} accent={PURPLE} action={{ label: "Planner", href: "/planner" }} />
            {upcomingMeetings.length === 0 ? (
              <Empty>No meetings scheduled.</Empty>
            ) : (
              <List>
                {upcomingMeetings.map((m) => (
                  <Row key={m.id}>
                    <span style={dot(PURPLE)} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={rowTitle}>{m.title}</span>
                      {m.contact && (
                        <ContactLink id={m.contact.id} label={m.contact.name || m.contact.email} />
                      )}
                    </span>
                    <span style={rowMeta}>
                      {m.startTime.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </Row>
                ))}
              </List>
            )}
          </Card>

          {/* New leads */}
          <Card>
            <CardHeader title="New leads" count={newLeads.length} accent={LIGHT.accent} action={{ label: "View all", href: "/contacts?stage=NEW" }} />
            {newLeads.length === 0 ? (
              <Empty>No new leads right now.</Empty>
            ) : (
              <List>
                {newLeads.map((c) => (
                  <Link key={c.id} href={`/contacts/${c.id}`} className="email-row" style={{ ...rowLinkStyle }}>
                    <Avatar seed={c.email} label={c.name || c.email} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ ...rowTitle, color: LIGHT.text }}>{c.name || c.email}</span>
                      <span style={rowSub}>{c.email}</span>
                    </span>
                    <span style={rowMeta}>{c.lastInteractionAt.toLocaleDateString()}</span>
                  </Link>
                ))}
              </List>
            )}
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader title="Recent email activity" count={recentEmails.length} accent={LIGHT.success} action={{ label: "Mailbox", href: "/zoho" }} />
            {recentEmails.length === 0 ? (
              <Empty>No email archived yet.</Empty>
            ) : (
              <List>
                {recentEmails.map((e) => {
                  const inbound = e.direction === "INBOUND";
                  return (
                    <Row key={e.id}>
                      <span
                        title={inbound ? "Received" : "Sent"}
                        style={{
                          flexShrink: 0,
                          fontSize: "0.62rem",
                          fontWeight: 800,
                          padding: "0.12rem 0.4rem",
                          borderRadius: 6,
                          background: inbound ? LIGHT.accentSoft : LIGHT.successSoft,
                          color: inbound ? LIGHT.accent : LIGHT.success,
                        }}
                      >
                        {inbound ? "IN" : "OUT"}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={rowTitle}>{e.subject || "(no subject)"}</span>
                        <span style={rowSub}>
                          {inbound ? "from " : "to "}
                          {inbound ? e.fromAddress : e.toAddress}
                        </span>
                      </span>
                      <span style={rowMeta}>{e.receivedAt.toLocaleDateString()}</span>
                    </Row>
                  );
                })}
              </List>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── charts ── */

/** A donut chart rendered as stacked stroke-dasharray arcs. */
function Donut({
  segments,
  total,
  size = 136,
  thickness = 20,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  size?: number;
  thickness?: number;
}) {
  const r = size / 2 - thickness / 2 - 1;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LIGHT.hover} strokeWidth={thickness} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const dash = (s.value / total) * circ;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
      </g>
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: LIGHT.text }}>
        {total}
      </text>
      <text x={size / 2} y={size / 2 + 15} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: LIGHT.textMuted, letterSpacing: "0.08em" }}>
        CONTACTS
      </text>
    </svg>
  );
}

/** A 14-day stacked bar chart of inbound/outbound email volume. */
function ActivityChart({
  days,
  max,
}: {
  days: { label: string; inbound: number; outbound: number }[];
  max: number;
}) {
  const H = 124;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: H }}>
        {days.map((d, i) => {
          const total = d.inbound + d.outbound;
          const inH = (d.inbound / max) * H;
          const outH = (d.outbound / max) * H;
          return (
            <div
              key={i}
              title={`${d.inbound} in · ${d.outbound} out`}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", gap: 2 }}
            >
              {total === 0 ? (
                <div style={{ height: 3, borderRadius: 2, background: LIGHT.border }} />
              ) : (
                <>
                  {outH > 0 && (
                    <div style={{ height: Math.max(outH, 3), background: LIGHT.success, borderRadius: "3px 3px 0 0" }} />
                  )}
                  {inH > 0 && (
                    <div style={{ height: Math.max(inH, 3), background: LIGHT.accent, borderRadius: outH > 0 ? 0 : "3px 3px 0 0" }} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.6rem", color: LIGHT.textMuted }}>
            {i % 2 === 1 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.76rem", color: LIGHT.textSecondary }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}

/* ── presentational bits ── */

function Metric({
  icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="email-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
        background: LIGHT.panel,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 14,
        padding: "0.85rem 1rem",
        textDecoration: "none",
        boxShadow: CARD_SHADOW,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: 10,
          background: softTint(accent),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.05rem",
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "1.55rem", fontWeight: 800, color: LIGHT.text, lineHeight: 1.05 }}>
          {value}
        </span>
        <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: LIGHT.textMuted, marginTop: "0.1rem" }}>
          {label}
        </span>
        {sub && <span style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: accent, marginTop: "0.1rem" }}>{sub}</span>}
      </span>
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: LIGHT.panel,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 14,
        padding: "1rem 1.1rem 1.1rem",
        boxShadow: CARD_SHADOW,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  count,
  accent,
  action,
}: {
  title: string;
  count?: number;
  accent?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
      {accent && <span style={{ width: 4, height: 16, borderRadius: 3, background: accent, flexShrink: 0 }} />}
      <h2 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: LIGHT.text }}>{title}</h2>
      {typeof count === "number" && (
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 800,
            color: LIGHT.textSecondary,
            background: LIGHT.hover,
            borderRadius: 999,
            padding: "0.05rem 0.45rem",
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
      {action && (
        <Link
          href={action.href}
          style={{ marginLeft: "auto", fontSize: "0.76rem", fontWeight: 700, color: LIGHT.accent, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0" }}>
      {children}
    </div>
  );
}

function Avatar({ seed, label }: { seed: string; label: string }) {
  return (
    <span
      style={{
        width: 30,
        height: 30,
        flexShrink: 0,
        borderRadius: "50%",
        background: avatarGradient(seed),
        color: "#fff",
        fontSize: "0.66rem",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials(label)}
    </span>
  );
}

function ContactLink({ id, label }: { id: string; label: string }) {
  return (
    <Link href={`/contacts/${id}`} style={{ display: "block", fontSize: "0.74rem", color: LIGHT.accent, textDecoration: "none" }}>
      {label}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0.4rem 0 0.2rem", fontSize: "0.82rem", color: LIGHT.textMuted }}>{children}</p>
  );
}

/** A soft translucent tint of an accent, for icon chips. */
function softTint(hex: string): string {
  const map: Record<string, string> = {
    [LIGHT.accent]: LIGHT.accentSoft,
    [LIGHT.success]: LIGHT.successSoft,
    [AMBER]: "#fdf1e3",
    [PURPLE]: "#f1ebfd",
  };
  return map[hex] ?? LIGHT.hover;
}

const rowTitle: CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: LIGHT.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const rowSub: CSSProperties = {
  display: "block",
  fontSize: "0.74rem",
  color: LIGHT.textMuted,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const rowMeta: CSSProperties = {
  fontSize: "0.72rem",
  color: LIGHT.textMuted,
  whiteSpace: "nowrap",
  flexShrink: 0,
};
const rowLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.4rem 0.4rem",
  margin: "0 -0.4rem",
  borderRadius: 9,
  textDecoration: "none",
};
function dot(color: string): CSSProperties {
  return { width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 };
}
