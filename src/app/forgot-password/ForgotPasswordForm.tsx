"use client";

import { useState } from "react";
import Link from "next/link";
import { LIGHT } from "../zoho/_components/ui";
import { inputStyle, fieldLabel, primaryBtn } from "../planner/_components/planner-ui";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    const res = await requestPasswordResetAction({ email });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSuccess(res.message ?? "Check your email for a reset link.");
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
          Forgot password
        </h1>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: LIGHT.textSecondary }}>
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {success ? (
          <div
            role="status"
            style={{
              fontSize: "0.85rem",
              color: LIGHT.text,
                background: LIGHT.accentSoft,
              border: `1px solid ${LIGHT.border}`,
              borderRadius: 8,
              padding: "0.75rem 0.85rem",
              marginBottom: "1rem",
              lineHeight: 1.45,
            }}
          >
            {success}
          </div>
        ) : (
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
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
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
