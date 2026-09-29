"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { LIGHT } from "../../zoho/_components/ui";
import { XIcon } from "../../_components/icons";
import {
  getPropertyDetails,
  createFollowUp,
  loadAllFollowUps,
  sendPropertyFollowUp,
  sendPropertyQuoteLink,
} from "../actions";
import type { PropertyDetail } from "../property_types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FollowUpItem {
  id: string;
  opportunityId: string;
  contactedBy?: string | null;
  contactMethod?: string | null;
  notes?: string | null;
  nextFollowUpDate?: Date | string | null;
  createdAt: Date | string;
}

const CONTACT_METHODS = ["EMAIL", "VISIT"] as const;

const EMPTY_FOLLOW_UP = {
  contactedBy: "",
  contactMethod: "CALL" as string,
  notes: "",
  nextFollowUpDate: "",
};

export interface PropertyDetailsDrawerProps {
  propertyId: string | null;
  onClose: () => void;
}

export function PropertyDetailsDrawer({
  propertyId,
  onClose,
}: PropertyDetailsDrawerProps) {
  const router = useRouter();
  const [navigating, startNavTransition] = useTransition();
  // #1 — typed state instead of any
  const [details, setDetails] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Follow-up form state (#5)
  const [showFUForm, setShowFUForm] = useState(false);
  const [fuData, setFUData] = useState(EMPTY_FOLLOW_UP);
  const [fuPending, startFUTransition] = useTransition();
  const [fuError, setFUError] = useState<string | null>(null);

  // All-follow-ups state (#6/#7)
  const [allFollowUps, setAllFollowUps] = useState<FollowUpItem[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  function fetchDetails(id: string) {
    startTransition(async () => {
      setError(null);
      setAllFollowUps(null); // reset load-all on re-fetch
      const res = await getPropertyDetails(id);
      if (!res.ok) { setError(res.error ?? "Failed to load property details."); return; }
      setDetails(res.property as unknown as PropertyDetail);
    });
  }

  useEffect(() => {
    if (!propertyId) { setDetails(null); setError(null); setShowFUForm(false); return; }
    fetchDetails(propertyId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function submitFollowUp() {
    const opportunityId = details?.opportunity?.id;
    if (!opportunityId) return;
    startFUTransition(async () => {
      setFUError(null);
      const res = await createFollowUp(opportunityId, {
        contactedBy: fuData.contactedBy.trim() || undefined,
        contactMethod: fuData.contactMethod || undefined,
        notes: fuData.notes.trim() || undefined,
        nextFollowUpDate: fuData.nextFollowUpDate || null,
      });
      if (!res.ok) { setFUError(res.error ?? "Failed to log follow-up."); return; }
      setFUData(EMPTY_FOLLOW_UP);
      setShowFUForm(false);
      // #5 — re-fetch details so the history list updates immediately
      if (propertyId) fetchDetails(propertyId);
    });
  }

  async function handleLoadAll() {
    const opportunityId = details?.opportunity?.id;
    if (!opportunityId) return;
    setLoadingAll(true);
    const res = await loadAllFollowUps(opportunityId);
    setLoadingAll(false);
    if (res.ok) setAllFollowUps(res.followUps as FollowUpItem[]);
  }

  async function handlePropertyAction(kind: "followup" | "quote") {
    if (!propertyId || actionPending) return;
    setActionPending(true);
    const res = kind === "followup" ? await sendPropertyFollowUp(propertyId) : await sendPropertyQuoteLink(propertyId);
    setActionPending(false);
    if (!res.ok) { window.alert(res.error ?? "Action failed."); return; }
    window.alert(kind === "quote" ? `Quote link sent${res.link ? `: ${res.link}` : "."}` : "Follow-up sent.");
    fetchDetails(propertyId);
  }

  if (!propertyId) return null;

  return (
    <>
      {/* Backdrop */}
      <div style={backdropStyle} onClick={onClose} />

      {/* Drawer */}
      <div style={drawerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={subLabelStyle}>Property Profile</div>
            <h2 style={titleStyle}>{details?.name || "Loading property..."}</h2>
          </div>
          {details && (
            <button
              onClick={() => {
                startNavTransition(() => {
                  router.push(`/properties/${propertyId}/edit`);
                });
              }}
              disabled={navigating}
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: LIGHT.accent,
                background: LIGHT.accentSoft,
                border: `1px solid ${LIGHT.accent}`,
                padding: "0.4rem 0.85rem",
                borderRadius: 8,
                marginRight: "0.5rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                cursor: navigating ? "not-allowed" : "pointer",
                opacity: navigating ? 0.6 : 1,
              }}
            >
              {navigating ? "Loading…" : "✏️ Edit"}
            </button>
          )}
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">
            <XIcon width={20} height={20} />
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {pending ? (
            <div style={loadingContainerStyle}>
              <div style={spinnerStyle} />
              <div style={{ marginTop: "1rem", color: LIGHT.textSecondary, fontSize: "0.88rem" }}>
                Loading property intelligence data...
              </div>
            </div>
          ) : error ? (
            <div style={errorContainerStyle}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
              <div style={{ color: LIGHT.danger, fontWeight: 600 }}>{error}</div>
            </div>
          ) : details ? (
            <div style={sectionsContainerStyle}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <button type="button" disabled={actionPending} onClick={() => handlePropertyAction("followup")} style={actionButtonStyle}>✉ Send Follow-Up</button>
                <button type="button" disabled={actionPending} onClick={() => handlePropertyAction("quote")} style={{ ...actionButtonStyle, background: LIGHT.accent, color: "#fff" }}>▣ Send Quote Link</button>
              </div>
              {/* Section 1: Overview & Location */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>🏢 Overview & Location</h3>
                <div style={gridStyle}>
                  <DetailRow label="Property Type" value={formatEnum(details.propertyType)} />
                  <DetailRow label="Management Company" value={details.managementCompany} />
                  <DetailRow label="Phone" value={details.phone} />
                  <DetailRow label="Website" value={details.website} href={details.website ?? undefined} />
                  <DetailRow
                    label="Street Address"
                    value={details.streetAddress}
                    fullWidth
                  />
                  <DetailRow label="City" value={details.city} />
                  <DetailRow label="State" value={details.state} />
                  <DetailRow label="Zip Code" value={details.zipCode} />
                </div>
              </div>

              {/* Section 2: Contacts */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>👤 Key Contacts</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <ContactBlock
                    title="Property Manager"
                    contact={findContact(details.contacts, "PROPERTY_MANAGER")}
                  />
                  <ContactBlock
                    title="Maintenance Manager"
                    contact={findContact(details.contacts, "MAINTENANCE_MANAGER")}
                  />
                  <ContactBlock
                    title="Regional Manager"
                    contact={findContact(details.contacts, "REGIONAL_MANAGER")}
                  />
                </div>
              </div>

              {/* Section 3: Physical Details */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>📐 Physical Details</h3>
                <div style={gridStyle}>
                  <DetailRow label="Number of Units" value={details.numberOfUnits} />
                  <DetailRow label="Estimated Residents" value={details.estimatedResidents} />
                  <DetailRow label="Year Built" value={details.yearBuilt} />
                </div>
              </div>

              {/* Section 4: Existing Systems */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>🔧 Existing Systems</h3>
                {details.existingSystem ? (
                  <div style={gridStyle}>
                    <DetailRow label="Call Box Brand" value={details.existingSystem.callBoxBrand} />
                    <DetailRow label="Call Box Model" value={details.existingSystem.callBoxModel} />
                    <DetailRow label="Call Box Qty" value={details.existingSystem.callBoxQuantity} />
                    <DetailRow label="Access Control Brand" value={details.existingSystem.accessControlBrand} />
                    <DetailRow label="Access Control Model" value={details.existingSystem.accessControlModel} />
                    <DetailRow label="Surveillance Brand" value={details.existingSystem.surveillanceBrand} />
                    <DetailRow label="Surveillance Model" value={details.existingSystem.surveillanceModel} />
                    <DetailRow
                      label="Accepted Credentials"
                      value={formatCredentials(details.existingSystem.credentials)}
                      fullWidth
                    />
                  </div>
                ) : (
                  <span style={emptyStateLabelStyle}>No system records found.</span>
                )}
              </div>

              {/* Section 5: Device Counts */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>🔢 Device Counts</h3>
                {details.deviceCount ? (
                  <div style={gridStyle}>
                    <DetailRow label="Access Controlled Doors" value={details.deviceCount.accessControlledDoors} />
                    <DetailRow label="Additional Doors to Secure" value={details.deviceCount.additionalDoorsToSecure} />
                    <DetailRow label="Vehicle Gates" value={details.deviceCount.vehicleGates} />
                    <DetailRow label="Pedestrian Gates" value={details.deviceCount.pedestrianGates} />
                    <DetailRow label="Garage Doors" value={details.deviceCount.garageDoors} />
                    <DetailRow label="ADA Door Operators" value={details.deviceCount.adaDoorOperators} />
                    <DetailRow label="Cameras" value={details.deviceCount.cameras} />
                  </div>
                ) : (
                  <span style={emptyStateLabelStyle}>No device count records found.</span>
                )}
              </div>

              {/* Section 6: Opportunity Ratings */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>🎯 Opportunity Ratings</h3>
                {details.opportunity ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={gridStyle}>
                      <DetailRow
                        label="Invisible Intercom Rating"
                        value={
                          <span style={ratingBadgeStyle(details.opportunity.invisibleIntercomRating)}>
                            {details.opportunity.invisibleIntercomRating}
                          </span>
                        }
                      />
                      <DetailRow
                        label="ButterflyMX Rating"
                        value={
                          <span style={ratingBadgeStyle(details.opportunity.butterflyMxRating)}>
                            {details.opportunity.butterflyMxRating}
                          </span>
                        }
                      />
                    </div>
                    <DetailRow
                      label="Opportunity Notes"
                      value={details.opportunity.opportunityNotes}
                      fullWidth
                    />
                  </div>
                ) : (
                  <span style={emptyStateLabelStyle}>No opportunity assessment record found.</span>
                )}
              </div>

              {/* Section 7: Follow-up & Status */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>📅 Follow-Up & Notes</h3>
                {details.opportunity ? (
                  <div>
                    <div style={gridStyle}>
                      <DetailRow
                        label="Qualification Status"
                        value={
                          <span style={statusBadgeStyle(details.opportunity.qualificationStatus)}>
                            {formatEnum(details.opportunity.qualificationStatus)}
                          </span>
                        }
                        fullWidth
                      />
                      <DetailRow
                        label="Next Follow-Up Date"
                        value={formatDate(details.opportunity.nextFollowUpDate)}
                      />
                      <DetailRow
                        label="Internal Notes"
                        value={details.opportunity.internalNotes}
                        fullWidth
                      />
                    </div>

                    {/* ── Log a Follow-Up Form (#5) ── */}
                    <div style={{ marginTop: "1.25rem" }}>
                      {!showFUForm ? (
                        <button
                          type="button"
                          onClick={() => setShowFUForm(true)}
                          style={{ fontSize: "0.78rem", fontWeight: 700, padding: "0.4rem 0.9rem", borderRadius: 8, border: `1px solid ${LIGHT.accent}`, background: LIGHT.accentSoft, color: LIGHT.accent, cursor: "pointer" }}
                        >
                          + Log Follow-Up
                        </button>
                      ) : (
                        <div style={{ background: LIGHT.panelAlt, border: `1px solid ${LIGHT.border}`, borderRadius: 10, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                          <div style={{ fontSize: "0.75rem", fontWeight: 800, color: LIGHT.text, marginBottom: "0.1rem" }}>Log Interaction</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <div>
                              <label style={fuLabelStyle}>Method</label>
                              <select value={fuData.contactMethod} onChange={(e) => setFUData((p) => ({ ...p, contactMethod: e.target.value }))} style={fuInputStyle}>
                                {CONTACT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={fuLabelStyle}>Contacted By</label>
                              <input style={fuInputStyle} type="text" placeholder="Your name" value={fuData.contactedBy} onChange={(e) => setFUData((p) => ({ ...p, contactedBy: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <label style={fuLabelStyle}>Notes</label>
                            <textarea style={{ ...fuInputStyle, minHeight: 56, resize: "vertical" }} placeholder="What was discussed..." value={fuData.notes} onChange={(e) => setFUData((p) => ({ ...p, notes: e.target.value }))} />
                          </div>
                          <div>
                            <label style={fuLabelStyle}>Next Follow-Up Date</label>
                            <input style={fuInputStyle} type="datetime-local" value={fuData.nextFollowUpDate} onChange={(e) => setFUData((p) => ({ ...p, nextFollowUpDate: e.target.value }))} />
                          </div>
                          {fuError && <div style={{ fontSize: "0.75rem", color: LIGHT.danger }}>{fuError}</div>}
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                            <button type="button" onClick={() => { setShowFUForm(false); setFUError(null); }} style={{ fontSize: "0.78rem", padding: "0.4rem 0.85rem", borderRadius: 7, border: `1px solid ${LIGHT.border}`, background: LIGHT.panel, color: LIGHT.textSecondary, cursor: "pointer" }}>Cancel</button>
                            <button type="button" onClick={submitFollowUp} disabled={fuPending} style={{ fontSize: "0.78rem", fontWeight: 700, padding: "0.4rem 0.85rem", borderRadius: 7, border: "none", background: fuPending ? LIGHT.textMuted : LIGHT.success, color: "#fff", cursor: fuPending ? "not-allowed" : "pointer" }}>{fuPending ? "Saving…" : "Save"}</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Follow-Up History (#6/#7/#10) ── */}
                    <div style={{ marginTop: "1.25rem" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                        Interaction History
                      </div>
                      {(() => {
                        const items = (allFollowUps ?? details.opportunity?.followUps ?? []) as FollowUpItem[];
                        const hasMore = !allFollowUps && items.length === 10;
                        return items.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {items.map((fu) => (
                              <div key={fu.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: fu.notes ? "0.35rem" : 0 }}>
                                  {fu.contactMethod && (
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                                      {fu.contactMethod}
                                    </span>
                                  )}
                                  <span style={{ fontSize: "0.78rem", color: "#374151", fontWeight: 600 }}>{fu.contactedBy ?? "Unknown"}</span>
                                  <span style={{ fontSize: "0.73rem", color: "#9ca3af", marginLeft: "auto" }}>{formatDate(fu.createdAt)}</span>
                                </div>
                                {fu.notes && <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280", lineHeight: 1.4 }}>{fu.notes}</p>}
                                {fu.nextFollowUpDate && <div style={{ marginTop: "0.25rem", fontSize: "0.73rem", color: "#059669" }}>Next: {formatDate(fu.nextFollowUpDate)}</div>}
                              </div>
                            ))}
                            {hasMore && (
                              <button type="button" onClick={handleLoadAll} disabled={loadingAll} style={{ alignSelf: "flex-start", fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.7rem", borderRadius: 7, border: `1px solid ${LIGHT.border}`, background: LIGHT.panelAlt, color: LIGHT.textSecondary, cursor: loadingAll ? "not-allowed" : "pointer" }}>
                                {loadingAll ? "Loading…" : "Show all interactions ↓"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={emptyStateLabelStyle}>No follow-up interactions logged yet.</span>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <span style={emptyStateLabelStyle}>No follow-up records found.</span>
                )}
              </div>

              {/* Section 8: Source Mail History */}
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>✉️ Email History</h3>
                {details.emailHistory?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {details.emailHistory.map((link) => {
                      const mail = link.storedEmail;
                      return (
                        <details key={link.id} style={{ border: `1px solid ${LIGHT.border}`, borderRadius: 8, padding: "0.55rem 0.7rem" }}>
                          <summary style={{ cursor: "pointer", color: LIGHT.text, fontSize: "0.82rem", fontWeight: 700 }}>
                            {mail.subject || "(No subject)"}
                            <span style={{ color: LIGHT.textMuted, fontWeight: 500 }}> · {formatDate(mail.receivedAt)}</span>
                          </summary>
                          <div style={{ marginTop: "0.45rem", fontSize: "0.76rem", color: LIGHT.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                            From: {mail.fromName ? `${mail.fromName} <${mail.fromAddress}>` : mail.fromAddress}\n\n{mail.bodyText}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                ) : <span style={emptyStateLabelStyle}>No stored emails are linked to this property yet.</span>}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 0.4; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ─── Drawer Helper Components ──────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  fullWidth = false,
  href,
}: {
  label: string;
  value: any;
  fullWidth?: boolean;
  href?: string;
}) {
  if (value === undefined || value === null || value === "") return null;

  return (
    <div
      style={{
        gridColumn: fullWidth ? "1 / -1" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.2rem",
      }}
    >
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>
        {href ? (
          <a
            href={href.startsWith("http") ? href : `https://${href}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: LIGHT.accent, textDecoration: "none" }}
          >
            {value} ↗
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

function ContactBlock({ title, contact }: { title: string; contact: any }) {
  if (!contact || (!contact.name && !contact.email && !contact.phone)) {
    return (
      <div style={contactBlockStyle}>
        <div style={contactBlockHeaderStyle}>{title}</div>
        <div style={{ fontSize: "0.8rem", color: LIGHT.textMuted }}>No contact registered</div>
      </div>
    );
  }

  return (
    <div style={contactBlockStyle}>
      <div style={contactBlockHeaderStyle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.3rem" }}>
        {contact.name && (
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: LIGHT.text }}>{contact.name}</div>
        )}
        {contact.email && (
          <div style={{ fontSize: "0.8rem", color: LIGHT.textSecondary }}>
            ✉ <a href={`mailto:${contact.email}`} style={{ color: LIGHT.textSecondary, textDecoration: "none" }}>{contact.email}</a>
          </div>
        )}
        {contact.phone && (
          <div style={{ fontSize: "0.8rem", color: LIGHT.textSecondary }}>
            📞 {contact.phone}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function findContact(contacts: any[], role: string) {
  return contacts?.find((c) => c.role === role);
}

function formatEnum(val: string): string {
  if (!val) return "";
  return val
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateString: any): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return String(dateString);
  }
}

function formatCredentials(credentials: any): string {
  if (!credentials) return "";
  try {
    const arr = typeof credentials === "string" ? JSON.parse(credentials) : credentials;
    if (Array.isArray(arr)) {
      return arr.map(formatEnum).join(", ");
    }
  } catch {}
  return String(credentials);
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: "fixed",
  top: 56, // APP_HEADER_HEIGHT
  left: 0,
  right: 0,
  bottom: 0,
  background: "#000",
  opacity: 0.4,
  zIndex: 1000,
  animation: "fadeIn 0.2s ease-out",
};

const drawerStyle: CSSProperties = {
  position: "fixed",
  top: 56, // APP_HEADER_HEIGHT
  right: 0,
  bottom: 0,
  width: "100%",
  maxWidth: 550,
  background: LIGHT.appBg,
  boxShadow: "-4px 0 30px rgba(0,0,0,0.15)",
  zIndex: 1001,
  display: "flex",
  flexDirection: "column",
  animation: "slideIn 0.25s ease-out",
};

const headerStyle: CSSProperties = {
  padding: "1.25rem 1.5rem",
  background: LIGHT.panel,
  borderBottom: `1px solid ${LIGHT.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const subLabelStyle: CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  color: LIGHT.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const titleStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  fontSize: "1.15rem",
  fontWeight: 800,
  color: LIGHT.text,
};

const closeBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: LIGHT.textSecondary,
  padding: "0.5rem",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s",
};

const contentStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "1.5rem",
  boxSizing: "border-box",
};

const loadingContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "5rem 1rem",
};

const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: `3px solid ${LIGHT.border}`,
  borderTopColor: LIGHT.accent,
  animation: "spin 0.8s linear infinite",
};

const errorContainerStyle: CSSProperties = {
  textAlign: "center",
  padding: "3rem 1.5rem",
};

const sectionsContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardStyle: CSSProperties = {
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "0.85rem",
  fontWeight: 800,
  color: LIGHT.text,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  paddingBottom: "0.4rem",
  borderBottom: `1px solid ${LIGHT.border}`,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.85rem",
};

const rowLabelStyle: CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  color: LIGHT.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const rowValueStyle: CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: LIGHT.text,
  wordBreak: "break-word",
};

const contactBlockStyle: CSSProperties = {
  background: LIGHT.panelAlt,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 8,
  padding: "0.75rem 1rem",
};

const contactBlockHeaderStyle: CSSProperties = {
  fontSize: "0.65rem",
  fontWeight: 800,
  color: LIGHT.accent,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const emptyStateLabelStyle: CSSProperties = {
  fontSize: "0.82rem",
  color: LIGHT.textMuted,
  fontStyle: "italic",
};

const fuLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.67rem",
  fontWeight: 700,
  color: LIGHT.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "0.2rem",
};

const fuInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.82rem",
  padding: "0.4rem 0.55rem",
  borderRadius: 7,
  border: `1px solid ${LIGHT.border}`,
  background: LIGHT.panel,
  color: LIGHT.text,
  outline: "none",
};

const actionButtonStyle: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 700,
  padding: "0.45rem 0.8rem",
  borderRadius: 8,
  border: `1px solid ${LIGHT.accent}`,
  background: LIGHT.accentSoft,
  color: LIGHT.accent,
  cursor: "pointer",
};

function statusBadgeStyle(status: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    NEW_PROSPECT: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
    RESEARCHING: { bg: "#fef3c7", fg: "#d97706" }, // Amber
    QUALIFIED: { bg: "#ecfdf5", fg: "#059669" }, // Emerald
    PROPOSAL_READY: { bg: "#edf2f7", fg: "#4a5568" }, // Cool gray
    PROPOSAL_SENT: { bg: "#e0e7ff", fg: "#4f46e5" }, // Indigo
    CUSTOMER: { bg: LIGHT.successSoft, fg: LIGHT.success },
    LOST: { bg: LIGHT.dangerSoft, fg: LIGHT.danger },
  };
  const c = map[status] ?? map.NEW_PROSPECT;
  return {
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "0.15rem 0.6rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
    display: "inline-block",
  };
}

function ratingBadgeStyle(rating: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    HIGH: { bg: LIGHT.successSoft, fg: LIGHT.success },
    MEDIUM: { bg: "#fff2e0", fg: "#c2620e" },
    LOW: { bg: LIGHT.dangerSoft, fg: LIGHT.danger },
    UNKNOWN: { bg: "#f3f4f6", fg: "#6b7280" },
  };
  const c = map[rating] ?? map.UNKNOWN;
  return {
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "0.15rem 0.5rem",
    borderRadius: 6,
    background: c.bg,
    color: c.fg,
    display: "inline-block",
  };
}
