"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import type { ZohoFolder } from "../../../lib/schemas/zoho";
import { folderIcon, LIGHT } from "./ui";

/**
 * Left-hand folder navigation (light, Zoho-style). Clicking a folder navigates
 * to `?folderId=...` inside a transition so we can show a spinner on the folder
 * being loaded while the server re-fetches its emails.
 */
export function FolderSidebar({
  folders,
  activeFolderId,
}: {
  accountId?: string;
  folders: ZohoFolder[];
  activeFolderId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function go(folderId: string) {
    if (folderId === activeFolderId) return;
    setPendingId(folderId);
    startTransition(() => {
      router.push(`/zoho?folderId=${folderId}`);
    });
  }

  return (
    <aside
      style={{
        background: LIGHT.panelAlt,
        borderRight: `1px solid ${LIGHT.border}`,
        padding: "0.6rem 0.5rem",
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      <div
        style={{
          color: LIGHT.textMuted,
          fontSize: "0.66rem",
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          padding: "0.5rem 0.7rem 0.6rem",
          fontWeight: 700,
        }}
      >
        Folders
      </div>

      {folders.map((folder) => {
        const name = folder.folderName ?? folder.path ?? folder.folderId;
        const active = folder.folderId === activeFolderId;
        const loading = isPending && pendingId === folder.folderId;
        const nested = (folder.path?.split("/").length ?? 0) > 2;
        const unread =
          folder.unreadCount != null ? Number(folder.unreadCount) : 0;

        return (
          <a
            key={folder.folderId}
            href={`/zoho?folderId=${folder.folderId}`}
            onClick={(e) => {
              e.preventDefault();
              go(folder.folderId);
            }}
            className="transition-all"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              padding: "0.5rem 0.7rem",
              paddingLeft: nested ? "1.5rem" : "0.7rem",
              borderRadius: 8,
              fontSize: "0.875rem",
              background: active ? LIGHT.selected : "transparent",
              color: active ? LIGHT.accent : LIGHT.text,
              fontWeight: active ? 700 : 500,
              marginBottom: 2,
              cursor: "pointer",
              opacity: isPending && !loading ? 0.6 : 1,
            }}
          >
            {active && (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: "60%",
                  borderRadius: 3,
                  background: LIGHT.accent,
                }}
              />
            )}
            <span
              style={{
                fontSize: "0.95rem",
                lineHeight: 1,
                display: "inline-flex",
                width: "1.1rem",
                justifyContent: "center",
              }}
            >
              {loading ? (
                <span
                  className="spinner"
                  style={{ width: "0.85rem", height: "0.85rem", color: LIGHT.accent }}
                />
              ) : (
                folderIcon(name)
              )}
            </span>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </span>
            {unread > 0 && !loading && (
              <span
                style={{
                  minWidth: 18,
                  textAlign: "center",
                  padding: "0.02rem 0.35rem",
                  borderRadius: 999,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  background: active ? LIGHT.accent : LIGHT.border,
                  color: active ? "#fff" : LIGHT.textSecondary,
                }}
              >
                {unread}
              </span>
            )}
          </a>
        );
      })}
    </aside>
  );
}
