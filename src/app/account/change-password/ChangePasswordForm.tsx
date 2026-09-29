"use client";

import { useState } from "react";
import Link from "next/link";
import { LIGHT } from "../../zoho/_components/ui";
import { inputStyle, fieldLabel, primaryBtn } from "../../planner/_components/planner-ui";
import { changePasswordAction } from "./actions";

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    const res = await changePasswordAction({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSuccess(res.message ?? "Your password has been updated.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
          maxWidth: 400,
          background: LIGHT.panel,
          border: `1px solid ${LIGHT.border}`,
          borderRadius: 16,
          padding: "1.75rem",
          boxShadow: "0 20px 50px rgba(15,23,42,0.12)",
        }}
      >
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.15rem", fontWeight: 800, color: LIGHT.text }}>
          Change password
        </h1>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: LIGHT.textSecondary, lineHeight: 1.45 }}>
          Enter your current password, then choose a new one (at least {MIN_PASSWORD_LENGTH} characters).
        </p>

        {success ? (
          <div
            role="status"
            style={{
              fontSize: "0.85rem",
              color: LIGHT.text,
              background: "#ecfdf5",
              border: "1px solid #6ee7b7",
              borderRadius: 8,
              padding: "0.75rem 0.85rem",
              marginBottom: "1rem",
              lineHeight: 1.45,
            }}
          >
            {success}
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <label style={fieldLabel}>
            Current password
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              autoFocus
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          <label style={fieldLabel}>
            New password
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>

          <label style={fieldLabel}>
            Confirm new password
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

        <p style={{ margin: "1.1rem 0 0", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.5 }}>
          <Link href="/forgot-password" style={{ color: LIGHT.accent, textDecoration: "none", fontWeight: 600 }}>
            Forgot your current password?
          </Link>
        </p>
      </div>
    </div>
  );
}
