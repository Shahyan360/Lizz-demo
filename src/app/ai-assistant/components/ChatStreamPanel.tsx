"use client";

import { useRef, useEffect } from "react";
import { LIGHT } from "../../zoho/_components/ui";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
};

interface ChatStreamPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  isSpeaking: boolean;
  error: string | null;
  input: string;
  onInputChange: (val: string) => void;
  onSend: (text: string) => void;
}

/** Strips internal control tokens the backend uses for state-tracking (never meant for display). */
function stripControlTokens(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[AWAITING_EMAIL_DECISION\]\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, idx) => {
      const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        return <strong key={`${keyPrefix}-${idx}`}>{boldMatch[1]}</strong>;
      }
      return <span key={`${keyPrefix}-${idx}`}>{part}</span>;
    });
}

/** Lightweight markdown-to-JSX renderer for the small subset of markdown the assistant emits (headings, bold, bullets, rules). Avoids dangerouslySetInnerHTML since message content can originate from untrusted email text. */
function renderMessageContent(raw: string): React.ReactNode {
  const text = stripControlTokens(raw);
  return text.split("\n").map((line, i) => {
    if (/^\s*---\s*$/.test(line)) {
      return (
        <hr
          key={i}
          style={{ border: "none", borderTop: `1px solid ${LIGHT.border}`, margin: "0.5rem 0" }}
        />
      );
    }
    const headerMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headerMatch) {
      return (
        <div key={i} style={{ fontWeight: 800, fontSize: "0.98rem", margin: "0.3rem 0 0.15rem" }}>
          {renderInline(headerMatch[1], `h${i}`)}
        </div>
      );
    }
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      return (
        <div key={i} style={{ paddingLeft: "0.9rem" }}>
          • {renderInline(bulletMatch[1], `b${i}`)}
        </div>
      );
    }
    if (line.trim() === "") {
      return <div key={i} style={{ height: "0.4rem" }} />;
    }
    return <div key={i}>{renderInline(line, `l${i}`)}</div>;
  });
}

export function ChatStreamPanel({
  messages,
  busy,
  isSpeaking,
  error,
  input,
  onInputChange,
  onSend,
}: ChatStreamPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, isSpeaking]);

  return (
    <div
      className="right-column"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 20,
        border: `1px solid ${LIGHT.border}`,
        background: LIGHT.panel,
        boxShadow: "0 12px 36px rgba(15,23,42,0.06)",
        overflow: "hidden",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: `1px solid ${LIGHT.border}`,
          background: LIGHT.panelAlt,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>💬</span>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: LIGHT.text, margin: 0 }}>
            Live Workspace Stream
          </h3>
        </div>
        <span style={{ fontSize: "0.78rem", color: LIGHT.textMuted }}>
          {messages.length} Messages
        </span>
      </div>

      {/* Messages Stream Scroll Container */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem",
          background: LIGHT.appBg,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          minHeight: 0,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "0.85rem 1.1rem",
                borderRadius: 14,
                fontSize: "0.92rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                color: LIGHT.text,
                background: m.role === "user" ? LIGHT.selected : LIGHT.panel,
                border: `1px solid ${
                  m.role === "user" ? LIGHT.accentSoft : LIGHT.border
                }`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: m.role === "user" ? LIGHT.accent : LIGHT.textMuted,
                  marginBottom: "0.25rem",
                }}
              >
                {m.role === "user" ? (m.isVoice ? "YOU (VOICE)" : "YOU (KEYBOARD)") : "Lizzz AI"}
              </div>
              {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div
            style={{
              alignSelf: "flex-start",
              fontSize: "0.85rem",
              color: LIGHT.textMuted,
              padding: "0.57rem 0.9rem",
              borderRadius: 10,
              background: LIGHT.panel,
              border: `1px solid ${LIGHT.border}`,
            }}
          >
            Lizzz is analyzing workspace data…
          </div>
        )}
      </div>

      {/* Manual Input Form Footer */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderTop: `1px solid ${LIGHT.border}`,
          background: LIGHT.panel,
          flexShrink: 0,
        }}
      >
        {error && (
          <div
            style={{
              fontSize: "0.82rem",
              color: LIGHT.danger,
              marginBottom: "0.5rem",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input;
            onInputChange("");
            onSend(text);
          }}
          style={{ display: "flex", gap: "0.65rem" }}
        >
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Type manually if preferred..."
            disabled={busy}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderRadius: 10,
              border: `1px solid ${LIGHT.borderStrong}`,
              fontSize: "0.92rem",
              outline: "none",
              background: LIGHT.panel,
              color: LIGHT.text,
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              padding: "0.75rem 1.4rem",
              borderRadius: 10,
              border: "none",
              background: `linear-gradient(135deg, ${LIGHT.accent}, #7c3aed)`,
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: busy || !input.trim() ? "default" : "pointer",
              opacity: busy || !input.trim() ? 0.55 : 1,
              boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
