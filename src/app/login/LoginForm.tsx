"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { LIGHT } from "../zoho/_components/ui";
import { inputStyle, fieldLabel, primaryBtn } from "../planner/_components/planner-ui";

/** Email + password sign-in form. Uses NextAuth's Credentials provider. */
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }
    // Refresh so server components (header, guarded pages) see the new session.
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 52px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: LIGHT.appBg,
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: LIGHT.panel,
          border: `1px solid ${LIGHT.border}`,
          borderRadius: 16,
          padding: "1.75rem",
          boxShadow: "0 20px 50px rgba(15,23,42,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.35rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${LIGHT.accent}, #7c3aed)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.05rem",
            }}
          >
            📬
          </div>
          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: LIGHT.text }}>
            Lizzz
          </span>
        </div>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: LIGHT.textSecondary }}>
          Sign in to your workspace.
        </p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <label style={fieldLabel}>
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
            />
          </label>

          <label style={fieldLabel}>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          <div style={{ marginTop: "-0.35rem", textAlign: "right" }}>
            <a
              href="/forgot-password"
              style={{
                fontSize: "0.78rem",
                color: LIGHT.accent,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Forgot password?
            </a>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: "0.8rem",
                color: LIGHT.danger,
                background: LIGHT.dangerSoft,
                border: `1px solid ${LIGHT.danger}`,
                borderRadius: 8,
                padding: "0.5rem 0.7rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              ...primaryBtn,
              justifyContent: "center",
              width: "100%",
              padding: "0.6rem 1rem",
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
