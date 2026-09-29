"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi, I’m Lizzz. How can I help?" },
  ]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = messages.slice(-10);
    setMessages((items) => [...items, { role: "user", content: text }]);
    setBusy(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await response.json();
      setMessages((items) => [
        ...items,
        { role: "assistant", content: response.ok ? data.reply : data.error || "Something went wrong." },
      ]);
    } catch {
      setMessages((items) => [...items, { role: "assistant", content: "I could not reach the assistant." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section aria-label="Lizzz assistant" style={panelStyle}>
          <header style={headerStyle}>
            <div><strong>Lizzz</strong><div style={{ fontSize: 11, opacity: 0.7 }}>Workspace assistant</div></div>
            <button type="button" onClick={() => setOpen(false)} style={closeStyle} aria-label="Close assistant">×</button>
          </header>
          <div style={messagesStyle}>
            {messages.map((message, index) => <div key={index} style={messageStyle(message.role)}>{message.content}</div>)}
            {busy && <div style={{ color: "#64748b", fontSize: 12 }}>Working…</div>}
          </div>
          <form onSubmit={submit} style={formStyle}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Lizzz…" style={inputStyle} aria-label="Message Lizzz" />
            <button type="submit" disabled={busy} style={sendStyle} aria-label="Send message">↑</button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} style={launcherStyle} aria-label="Open Lizzz assistant" title="Open Lizzz assistant">✦</button>
    </>
  );
}

const launcherStyle = { position: "fixed" as const, right: 22, bottom: 22, width: 48, height: 48, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", background: "#172033", color: "#fff", fontSize: 22, boxShadow: "0 12px 30px rgba(15,23,42,.25)", cursor: "pointer", zIndex: 300 };
const panelStyle = { position: "fixed" as const, right: 22, bottom: 82, width: "min(360px, calc(100vw - 32px))", height: 470, display: "flex", flexDirection: "column" as const, background: "#fff", border: "1px solid #dbe3ef", borderRadius: 16, boxShadow: "0 18px 50px rgba(15,23,42,.2)", overflow: "hidden", zIndex: 300 };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#172033", color: "#fff" };
const closeStyle = { border: 0, background: "transparent", color: "#fff", fontSize: 22, cursor: "pointer" };
const messagesStyle = { flex: 1, overflowY: "auto" as const, padding: 14, display: "flex", flexDirection: "column" as const, gap: 9, background: "#f7f9fc" };
const messageStyle = (role: Message["role"]) => ({ alignSelf: role === "user" ? "flex-end" as const : "flex-start" as const, maxWidth: "88%", padding: "9px 11px", borderRadius: 11, background: role === "user" ? "#2563eb" : "#fff", color: role === "user" ? "#fff" : "#172033", border: role === "user" ? "0" : "1px solid #e2e8f0", whiteSpace: "pre-wrap" as const, fontSize: 13, lineHeight: 1.4 });
const formStyle = { display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e2e8f0" };
const inputStyle = { flex: 1, minWidth: 0, border: "1px solid #dbe3ef", borderRadius: 9, padding: "9px 10px", outline: "none" };
const sendStyle = { width: 36, border: 0, borderRadius: 9, background: "#2563eb", color: "#fff", fontSize: 18, cursor: "pointer" };
