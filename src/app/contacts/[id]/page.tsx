import { NavLink as Link } from "../../_components/NavLink";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getOrCreateTenant } from "../../../lib/tenant";
import { prisma } from "../../../lib/prisma";
import { getContactTimeline } from "../../../lib/repositories/contact-timeline";
import { LIGHT, initials, avatarGradient } from "../../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../../_components/app-nav";
import { ContactNotes } from "./ContactNotes";
import { ContactStage } from "./ContactStage";
import { ContactEditor } from "./ContactEditor";
import { ContactTimeline } from "./ContactTimeline";

/**
 * /contacts/[id] — CRM "Contact 360": profile, notes, and one unified timeline
 * of every email, task, deal, and meeting linked to this contact.
 */
export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tenant = await getOrCreateTenant();
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
  });
  if (!contact) notFound();

  const timeline = await getContactTimeline({
    id: contact.id,
    email: contact.email,
  });

  const name = contact.name || contact.email;

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
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        <Link
          href="/contacts"
          style={{
            fontSize: "0.82rem",
            color: LIGHT.textSecondary,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            marginBottom: "1rem",
          }}
        >
          ← All contacts
        </Link>

        <div
          style={{
            background: LIGHT.panel,
            border: `1px solid ${LIGHT.border}`,
            borderRadius: 14,
            padding: "1.25rem 1.35rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: avatarGradient(contact.email),
                color: "#fff",
                fontSize: "1.1rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {initials(name)}
            </span>
            <ContactEditor
              contactId={contact.id}
              initialName={contact.name}
              initialEmail={contact.email}
            />
            <ContactStage contactId={contact.id} initialStage={contact.lifecycleStage} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.1rem" }}>
            <Stat label="Emails" value={String(timeline.stats.emails)} />
            <Stat label="Open tasks" value={String(timeline.stats.openTasks)} />
            <Stat label="Deals" value={String(timeline.stats.deals)} />
            <Stat label="Meetings" value={String(timeline.stats.meetings)} />
            <Stat
              label="Last contact"
              value={contact.lastInteractionAt.toLocaleDateString()}
            />
          </div>

          <div
            style={{
              marginTop: "1.15rem",
              paddingTop: "1.1rem",
              borderTop: `1px solid ${LIGHT.border}`,
            }}
          >
            <ContactNotes contactId={contact.id} initialNotes={contact.notes ?? ""} />
          </div>
        </div>

        <ContactTimeline items={timeline.items} counts={timeline.stats} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  const box: CSSProperties = {
    background: LIGHT.panelAlt,
    border: `1px solid ${LIGHT.border}`,
    borderRadius: 10,
    padding: "0.5rem 0.8rem",
    minWidth: 92,
  };
  return (
    <div style={box}>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: LIGHT.text }}>{value}</div>
      <div
        style={{
          fontSize: "0.68rem",
          color: LIGHT.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}
