"use client";

import { LIGHT } from "../../zoho/_components/ui";
import { ChevronLeft, ChevronRight } from "./icons";
import { iconBtn } from "./planner-ui";

/** Prev / page-indicator / next control. Renders nothing for a single page. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        marginTop: "1rem",
        paddingTop: "0.75rem",
        borderTop: `1px solid ${LIGHT.border}`,
      }}
    >
      <span style={{ fontSize: "0.78rem", color: LIGHT.textMuted }}>
        {from}–{to} of {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          style={{ ...iconBtn(LIGHT.textSecondary), opacity: page <= 1 ? 0.4 : 1 }}
        >
          <ChevronLeft />
        </button>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: LIGHT.textSecondary }}>
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          style={{
            ...iconBtn(LIGHT.textSecondary),
            opacity: page >= pageCount ? 0.4 : 1,
          }}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
