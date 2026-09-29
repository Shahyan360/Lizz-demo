"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { useSession, signOut } from "next-auth/react";
import { LIGHT, initials, avatarGradient } from "../zoho/_components/ui";
import { APP_HEADER_HEIGHT, NAV_ITEMS } from "./app-nav";
import { NavLink } from "./NavLink";
import {
  InboxIcon,
  MenuIcon,
  XIcon,
  UsersIcon,
  BanIcon,
  LogOutIcon,
  EditIcon,
} from "./icons";
import { useIsMobile } from "../_hooks/useIsMobile";

/**
 * The global application header — a fixed top bar with the app brand, the
 * primary navigation, and the signed-in user (sign-out, plus admin links).
 * Responsive: below ~820px the nav collapses into a hamburger drawer so it never
 * overflows on mobile. Rendered once in the root layout; hidden on /login.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isMobile = useIsMobile(820);
  // Between the mobile breakpoint and ~1200px (typical laptop window width),
  // the full label set doesn't fit — fall back to icon-only nav with tooltips.
  const isNarrowDesktop = useIsMobile(1200);
  const isCompact = isNarrowDesktop && !isMobile;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Auth pages are chrome-free.
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password")
  ) {
    return null;
  }

  const authed = status === "authenticated" && Boolean(session?.user);
  const name = session?.user?.name || session?.user?.email || "Account";
  const email = session?.user?.email || "";
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: APP_HEADER_HEIGHT,
        zIndex: 300, // above the full-screen page overlays (which use z-index 100)
        display: "flex",
        alignItems: "center",
        gap: isCompact ? "0.75rem" : "1.25rem",
        padding: "0 1rem",
        background: LIGHT.panel,
        borderBottom: `1px solid ${LIGHT.border}`,
      }}
    >
      {/* Brand */}
      <NavLink
        href={authed ? "/dashboard" : "/"}
        style={{ display: "flex", alignItems: "center", gap: "0.55rem", textDecoration: "none" }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${LIGHT.accent}, #7c3aed)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <InboxIcon width={17} height={17} />
        </div>
        <span style={{ fontSize: "0.95rem", fontWeight: 800, color: LIGHT.text }}>
          Lizzz
        </span>
      </NavLink>

      {/* Desktop navigation */}
      {!isMobile && (
        <nav style={{ display: "flex", alignItems: "center", gap: isCompact ? "0.1rem" : "0.2rem" }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              title={isCompact ? item.label : undefined}
              style={navLinkStyle(isActive(pathname, item.href), isCompact)}
            >
              <item.icon width={16} height={16} />
              {!isCompact && item.label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {!isMobile && authed && (
          <UserMenu name={name} email={email} isAdmin={isAdmin} currentPath={pathname} compact={isCompact} />
        )}
        {isMobile && (
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 34,
              borderRadius: 9,
              border: `1px solid ${LIGHT.border}`,
              background: drawerOpen ? LIGHT.accentSoft : LIGHT.panel,
              color: drawerOpen ? LIGHT.accent : LIGHT.text,
              cursor: "pointer",
            }}
          >
            {drawerOpen ? <XIcon width={19} height={19} /> : <MenuIcon width={19} height={19} />}
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              top: APP_HEADER_HEIGHT,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15,23,42,0.35)",
              zIndex: 350,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: APP_HEADER_HEIGHT,
              left: 0,
              right: 0,
              background: LIGHT.panel,
              borderBottom: `1px solid ${LIGHT.border}`,
              boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
              padding: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.1rem",
              zIndex: 400,
              maxHeight: "calc(100vh - " + APP_HEADER_HEIGHT + "px)",
              overflowY: "auto",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.7rem 0.75rem",
                    borderRadius: 9,
                    fontSize: "0.92rem",
                    fontWeight: active ? 700 : 500,
                    textDecoration: "none",
                    color: active ? "#fff" : LIGHT.text,
                    background: active ? LIGHT.accent : "transparent",
                  }}
                >
                  <item.icon width={18} height={18} />
                  {item.label}
                </NavLink>
              );
            })}

            {authed && (
              <>
                <div style={{ height: 1, background: LIGHT.border, margin: "0.4rem 0" }} />
                <div style={{ padding: "0.2rem 0.75rem 0.5rem" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: LIGHT.text }}>{name}</div>
                  {email && (
                    <div style={{ fontSize: "0.74rem", color: LIGHT.textMuted, marginTop: 2 }}>{email}</div>
                  )}
                </div>
                <AccountLinks isAdmin={isAdmin} currentPath={pathname} onNavigate={() => setDrawerOpen(false)} />
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Desktop avatar dropdown. */
function UserMenu({
  name,
  email,
  isAdmin,
  currentPath,
  compact = false,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
  currentPath: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const seed = email || name;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.25rem 0.5rem 0.25rem 0.3rem",
          borderRadius: 999,
          border: `1px solid ${LIGHT.border}`,
          background: LIGHT.panel,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: avatarGradient(seed),
            color: "#fff",
            fontSize: "0.68rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials(name || email)}
        </span>
        {!compact && (
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: LIGHT.text,
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
        )}
        <span style={{ fontSize: "0.6rem", color: LIGHT.textMuted }}>▾</span>
      </button>

      {open && (
        <div
          // Prevent the trigger button's onBlur from closing the menu before
          // menu item clicks (especially Sign out) can fire.
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 210,
            background: LIGHT.panel,
            border: `1px solid ${LIGHT.border}`,
            borderRadius: 12,
            boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
            padding: "0.4rem",
            zIndex: 400,
          }}
        >
          <div style={{ padding: "0.4rem 0.6rem 0.55rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: LIGHT.text }}>{name}</div>
            {email && (
              <div style={{ fontSize: "0.72rem", color: LIGHT.textMuted, marginTop: 2 }}>{email}</div>
            )}
            {isAdmin && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  color: LIGHT.accent,
                  background: LIGHT.accentSoft,
                  borderRadius: 999,
                  padding: "0.1rem 0.5rem",
                }}
              >
                ADMIN
              </span>
            )}
          </div>
          <div style={{ height: 1, background: LIGHT.border, margin: "0.2rem 0" }} />
          <AccountLinks isAdmin={isAdmin} currentPath={currentPath} />
        </div>
      )}
    </div>
  );
}

/** The account links shared by the desktop dropdown and mobile drawer. */
function AccountLinks({
  isAdmin,
  currentPath,
  onNavigate,
}: {
  isAdmin: boolean;
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <NavLink
        href="/planner?view=team"
        onClick={onNavigate}
        style={{
          ...menuItemStyle,
          color: LIGHT.text,
        }}
      >
        <UsersIcon width={16} height={16} />
        Team view
      </NavLink>
      <NavLink
        href="/account/change-password"
        onClick={onNavigate}
        style={{
          ...menuItemStyle,
          color: currentPath.startsWith("/account/change-password")
            ? LIGHT.accent
            : LIGHT.text,
        }}
      >
        <EditIcon width={16} height={16} />
        Change password
      </NavLink>
      {isAdmin && (
        <NavLink
          href="/admin/users"
          onClick={onNavigate}
          style={{
            ...menuItemStyle,
            color: currentPath.startsWith("/admin/users") ? LIGHT.accent : LIGHT.text,
          }}
        >
          <UsersIcon width={16} height={16} />
          Manage users
        </NavLink>
      )}
      {isAdmin && (
        <NavLink
          href="/admin/team-members"
          onClick={onNavigate}
          style={{
            ...menuItemStyle,
            color: currentPath.startsWith("/admin/team-members")
              ? LIGHT.accent
              : LIGHT.text,
          }}
        >
          <UsersIcon width={16} height={16} />
          Team members
        </NavLink>
      )}
      <NavLink
        href="/blocked-senders"
        onClick={onNavigate}
        style={{
          ...menuItemStyle,
          color: currentPath.startsWith("/blocked-senders") ? LIGHT.accent : LIGHT.text,
        }}
      >
        <BanIcon width={16} height={16} />
        Blocked senders
      </NavLink>
      <button
        type="button"
        onClick={() => {
          void signOut({ callbackUrl: "/login", redirect: true });
        }}
        onMouseDown={(e) => e.preventDefault()}
        style={{ ...menuItemStyle, width: "100%", textAlign: "left", background: "transparent" }}
      >
        <LogOutIcon width={16} height={16} />
        Sign out
      </button>
    </>
  );
}

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.55rem",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "none",
  fontSize: "0.86rem",
  fontWeight: 600,
  color: LIGHT.text,
  textDecoration: "none",
  cursor: "pointer",
  background: "transparent",
};

function navLinkStyle(active: boolean, compact: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: compact ? 0 : "0.4rem",
    padding: compact ? "0.5rem" : "0.4rem 0.7rem",
    borderRadius: 8,
    fontSize: "0.85rem",
    fontWeight: active ? 700 : 500,
    textDecoration: "none",
    color: active ? "#fff" : LIGHT.textSecondary,
    background: active ? LIGHT.accent : "transparent",
    whiteSpace: "nowrap",
  };
}
