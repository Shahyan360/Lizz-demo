"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { LIGHT } from "../../zoho/_components/ui";

export function PropertyTypeFilter({
  activeType,
  status,
  query,
}: {
  activeType: string;
  status: string;
  query: string;
}) {
  const router = useRouter();

  function onChange(val: string) {
    const params = new URLSearchParams();
    if (status && status !== "ALL") params.set("status", status);
    if (val && val !== "ALL") params.set("type", val);
    if (query) params.set("q", query);
    const qs = params.toString();
    router.replace(qs ? `/properties?${qs}` : "/properties");
  }

  return (
    <select
      value={activeType}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle}
      aria-label="Filter by property type"
    >
      <option value="ALL">All Types</option>
      <option value="APARTMENT">Apartment</option>
      <option value="MULTIFAMILY">Multifamily</option>
      <option value="HOA">HOA</option>
      <option value="CONDO_COMMUNITY">Condo Community</option>
    </select>
  );
}

const selectStyle: CSSProperties = {
  padding: "0.55rem 1.75rem 0.55rem 0.75rem",
  fontSize: "0.86rem",
  fontWeight: 600,
  color: LIGHT.textSecondary,
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 10,
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235c6672' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  backgroundSize: "14px",
};
