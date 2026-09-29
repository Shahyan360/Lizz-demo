"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIGHT } from "../zoho/_components/ui";
import { inputStyle, fieldLabel, primaryBtn } from "../planner/_components/planner-ui";
import { resetPasswordAction } from "../forgot-password/actions";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({
  token,
  tokenValid,
}: {
  token: string;
  tokenValid: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await resetPasswordAction({ token, password, confirmPassword });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong. Please try again.");
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/login"), 1500);
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
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.15rem", fontWeight: 800, color: LIGHT.text }}>
          Reset password
        </h1>

        {!tokenValid ? (
          <>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: LIGHT.textSecondary, lineHeight: 1.45 }}>
              This reset link is invalid or has expired. Request a new one from the forgot password page.
            </p>
            <p style={{ margin: 0, fontSize: "0.8rem", textAlign: "center" }}>
              <Link href="/forgot-password" style={{ color: LIGHT.accent, textDecoration: "none", fontWeight: 600 }}>
                Request a new link
              </Link>
            </p>
          </>
        ) : done ? (
          <div
            role="status"
            style={{
              fontSize: "0.85rem",
              color: LIGHT.text,
              background: "#ecfdf5",
              border: "1px solid #6ee7b7",
              borderRadius: 8,
              padding: "0.75rem 0.85rem",
              lineHeight: 1.45,
            }}
          >
            Password updated. Redirecting you to sign in…
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: LIGHT.textSecondary }}>
              Choose a new password (at least {MIN_PASSWORD_LENGTH} characters).
            </p>
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <label style={fieldLabel}>
                New password
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  autoFocus
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                Confirm password
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </label>

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
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}

        <p style={{ margin: "1.1rem 0 0", fontSize: "0.8rem", textAlign: "center" }}>
          <Link href="/login" style={{ color: LIGHT.accent, textDecoration: "none", fontWeight: 600 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
