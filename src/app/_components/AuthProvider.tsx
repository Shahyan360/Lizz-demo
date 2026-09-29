"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client wrapper enabling `useSession()` across the app. Rendered once, at the
 * top of the root layout, so the header and any client component can read the
 * signed-in user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
