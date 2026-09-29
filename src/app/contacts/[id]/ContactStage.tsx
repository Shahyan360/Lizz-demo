"use client";

import { useState, useTransition } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useToast } from "../../_components/Toast";
import { setContactStage } from "../actions";

const STAGES = [
  { value: "NEW", label: "New lead" },
  { value: "ACTIVE", label: "Active" },
  { value: "CUSTOMER", label: "Customer" },
] as const;

const COLORS: Record<string, { bg: string; fg: string }> = {
  NEW: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
  ACTIVE: { bg: "#fff2e0", fg: "#c2620e" },
  CUSTOMER: { bg: LIGHT.successSoft, fg: LIGHT.success },
};

/** Inline lifecycle-stage selector for a contact (New / Active / Customer). */
export function ContactStage({
  contactId,
  initialStage,
}: {
  contactId: string;
  initialStage: string;
}) {
  const toast = useToast();
  const [stage, setStage] = useState(initialStage);
  const [pending, start] = useTransition();
  const c = COLORS[stage] ?? COLORS.NEW;

  function change(next: string) {
    const prev = stage;
    setStage(next);
    start(async () => {
      const res = await setContactStage(contactId, next);
      if (!res.ok) {
        setStage(prev);
        toast.error(res.error ?? "Could not update stage.");
      } else {
        toast.success("Stage updated.");
      }
    });
  }

  return (
    <select
      value={stage}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      aria-label="Lifecycle stage"
      style={{
        border: `1px solid ${c.fg}33`,
        background: c.bg,
        color: c.fg,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
        padding: "0.28rem 0.55rem",
        borderRadius: 999,
        cursor: pending ? "default" : "pointer",
        outline: "none",
      }}
    >
      {STAGES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
