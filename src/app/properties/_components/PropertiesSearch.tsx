"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { SearchIcon, XIcon } from "../../_components/icons";

/**
 * Search box for the properties list. Filters live as you type (debounced) by
 * updating a `q` (name, company, or city) URL param, preserving the active
 * status and type filters, and resetting to page 1.
 */
export function PropertiesSearch({
  initialQuery,
  status,
  type,
}: {
  initialQuery: string;
  status: string;
  type: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(next: string) {
    const params = new URLSearchParams();
    if (status && status !== "ALL") params.set("status", status);
    if (type && type !== "ALL") params.set("type", type);
    if (next.trim()) params.set("q", next.trim());
    const qs = params.toString();
    router.replace(qs ? `/properties?${qs}` : "/properties");
  }

  function onChange(next: string) {
    setQ(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(next), 300);
  }

  function submit() {
    if (timer.current) clearTimeout(timer.current);
    go(q);
  }

  // Clean up debounced trigger on unmount
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 360 }}
    >
      <span
        style={{
          position: "absolute",
          left: 11,
          top: "50%",
          transform: "translateY(-50%)",
          color: LIGHT.textMuted,
          pointerEvents: "none",
          display: "flex",
        }}
      >
        <SearchIcon width={16} height={16} />
      </span>
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search property, company, or city…"
        aria-label="Search properties"
        style={inputStyle}
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            setQ("");
            go("");
          }}
          aria-label="Clear search"
          style={clearBtn}
        >
          <XIcon width={15} height={15} />
        </button>
      )}
    </form>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.5rem 2rem 0.5rem 2.2rem",
  fontSize: "0.86rem",
  color: LIGHT.text,
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 10,
  outline: "none",
};

const clearBtn: CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: LIGHT.textMuted,
  cursor: "pointer",
  padding: "0.2rem",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
};
