"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useNavigationProgress } from "./NavigationProgress";

type NavLinkProps = ComponentProps<typeof Link>;

/** App navigation link that shows immediate loading feedback on click. */
export function NavLink({ href, onClick, ...props }: NavLinkProps) {
  const { startNavigation } = useNavigationProgress();
  const target = typeof href === "string" ? href : href.pathname ?? "/";

  return (
    <Link
      href={href}
      onClick={(event) => {
        startNavigation(target);
        onClick?.(event);
      }}
      {...props}
    />
  );
}
