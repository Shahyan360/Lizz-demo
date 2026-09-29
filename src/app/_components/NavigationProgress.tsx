"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_HEADER_HEIGHT } from "./app-nav";
import { LIGHT } from "../zoho/_components/ui";

type NavigationProgressContextValue = {
  pending: boolean;
  startNavigation: (href: string) => void;
};

const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);

function currentLocation(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function normalizeTarget(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    try {
      const url = new URL(href);
      return `${url.pathname}${url.search}`;
    } catch {
      return href;
    }
  }
  return href.startsWith("/") ? href : `/${href}`;
}

function isSameDestination(
  pathname: string,
  searchParams: URLSearchParams,
  href: string
): boolean {
  const target = normalizeTarget(href);
  const [targetPath, targetQuery = ""] = target.split("?");
  const current = currentLocation(pathname, searchParams);

  if (current === target) return true;
  if (pathname === targetPath && !targetQuery) return true;
  return false;
}

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchParams]);

  const startNavigation = useCallback(
    (href: string) => {
      if (isSameDestination(pathname, searchParams, href)) return;
      setPending(true);
    },
    [pathname, searchParams]
  );

  return (
    <NavigationProgressContext.Provider value={{ pending, startNavigation }}>
      {pending ? (
        <>
          <div className="nav-progress-bar" aria-hidden="true" />
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading page"
            style={{
              position: "fixed",
              top: APP_HEADER_HEIGHT,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 250,
              background: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(1px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              color: LIGHT.textSecondary,
              pointerEvents: "none",
            }}
          >
            <span
              className="spinner"
              aria-hidden="true"
              style={{
                width: "2rem",
                height: "2rem",
                borderWidth: "3px",
                color: LIGHT.accent,
              }}
            />
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Loading…</span>
          </div>
        </>
      ) : null}
      {children}
    </NavigationProgressContext.Provider>
  );
}

export function useNavigationProgress(): NavigationProgressContextValue {
  const ctx = useContext(NavigationProgressContext);
  if (!ctx) {
    throw new Error("useNavigationProgress must be used within NavigationProgressProvider");
  }
  return ctx;
}
