"use client";

import { useEffect, useRef } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { WaveformCanvas } from "./WaveformCanvas";

interface HandsfreeGlobeCoreProps {
  handsfree: boolean;
  listenMode: "idle" | "active";
  isListening: boolean;
  isSpeaking: boolean;
  busy: boolean;
  interimTranscript: string;
  liveCaptionText: string;
  onToggleHandsfree: () => void;
  onStopSpeaking: () => void;
}

export function HandsfreeGlobeCore({
  handsfree,
  listenMode,
  isListening,
  isSpeaking,
  busy,
  interimTranscript,
  liveCaptionText,
  onToggleHandsfree,
  onStopSpeaking,
}: HandsfreeGlobeCoreProps) {
  const captionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll caption to bottom as new words are spoken
  useEffect(() => {
    if (captionRef.current) {
      captionRef.current.scrollTop = captionRef.current.scrollHeight;
    }
  }, [liveCaptionText]);

  return (
    <div
      className="left-column"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "2rem 1.5rem",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 20,
        boxShadow: "0 12px 36px rgba(15,23,42,0.06)",
        position: "relative",
        overflow: "auto",
        height: "100%",
        boxSizing: "border-box",
        gap: "1rem",
      }}
    >
      {/* Ambient Glow */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            listenMode === "active"
              ? "radial-gradient(circle, rgba(239,68,68,0.22) 0%, rgba(255,255,255,0) 70%)"
              : isSpeaking
              ? "radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(255,255,255,0) 70%)"
              : busy
              ? "radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(255,255,255,0) 70%)"
              : isListening
              ? "radial-gradient(circle, rgba(245,158,11,0.15) 0%, rgba(255,255,255,0) 70%)"
              : "radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(255,255,255,0) 70%)",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          transition: "all 0.5s ease",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 2 }}>
        <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: LIGHT.text, margin: 0 }}>
          {busy
            ? "Searching Workspace..."
            : isSpeaking
            ? "Lizzz Answering..."
            : listenMode === "active"
            ? "Listening... Speak your command!"
            : isListening
            ? "Waiting for \"Hello Assistant\"..."
            : "Wake Word Mode"}
        </h2>
        <p style={{ fontSize: "0.85rem", color: LIGHT.textMuted, marginTop: "0.35rem" }}>
          {handsfree
            ? listenMode === "active"
              ? "Command mode active — speak your question now."
              : "Say \"Hello Assistant\" to activate — I ignore everything else."
            : "Wake word mode paused. Click Globe or Toggle ON to resume."}
        </p>
      </div>

      {/* Central Globe Core */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "1rem 0",
          zIndex: 2,
        }}
      >
        {/* Animated Mesh Orbit 1 */}
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: `2px dashed ${
              listenMode === "active"
                ? "rgba(239,68,68,0.7)"
                : isSpeaking
                ? "rgba(16,185,129,0.7)"
                : busy
                ? "rgba(37,99,235,0.7)"
                : isListening
                ? "rgba(245,158,11,0.6)"
                : "rgba(99,102,241,0.35)"
            }`,
            animation: "spin 10s linear infinite",
          }}
        />

        {/* Animated Mesh Orbit 2 */}
        <div
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            borderRadius: "50%",
            border: `1.5px solid ${
              listenMode === "active"
                ? "rgba(239,68,68,0.4)"
                : isSpeaking
                ? "rgba(16,185,129,0.4)"
                : busy
                ? "rgba(37,99,235,0.4)"
                : isListening
                ? "rgba(245,158,11,0.35)"
                : "rgba(124,58,237,0.25)"
            }`,
            transform: "rotateX(65deg)",
            animation: "spin 7s linear infinite reverse",
          }}
        />

        <button
          type="button"
          onClick={onToggleHandsfree}
          title={handsfree ? "Click to turn off handsfree mode" : "Click to turn on handsfree mode"}
          style={{
            width: 145,
            height: 145,
            borderRadius: "50%",
            border: "none",
            background: busy
              ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
              : isSpeaking
              ? "linear-gradient(135deg, #10b981 0%, #047857 100%)"
              : listenMode === "active"
              ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
              : isListening
              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              : "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            color: "#ffffff",
            fontSize: "4.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: busy
              ? "0 0 45px rgba(59,130,246,0.65)"
              : isSpeaking
              ? "0 0 45px rgba(16,185,129,0.65)"
              : listenMode === "active"
              ? "0 0 45px rgba(239,68,68,0.65)"
              : isListening
              ? "0 0 35px rgba(245,158,11,0.55)"
              : "0 14px 35px rgba(37,99,235,0.35)",
            transform: listenMode === "active" || isSpeaking ? "scale(1.06)" : "scale(1)",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 3,
          }}
        >
          {busy ? "⚙️" : isSpeaking ? "🔊" : listenMode === "active" ? "🎙️" : isListening ? "👂" : "🌍"}
        </button>
      </div>

      {/* Waveform Canvas */}
      <WaveformCanvas
        listenMode={listenMode}
        isListening={isListening}
        isSpeaking={isSpeaking}
        busy={busy}
      />

      {/* Real-time Live Transcript & Control Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "0.75rem 1rem",
          borderRadius: 14,
          background: busy
            ? "#eff6ff"
            : isSpeaking
            ? "#ecfdf5"
            : listenMode === "active"
            ? "#fef2f2"
            : isListening
            ? "#fffbeb"
            : LIGHT.panelAlt,
          border: `1px solid ${
            busy
              ? "#bfdbfe"
              : isSpeaking
              ? "#a7f3d0"
              : listenMode === "active"
              ? "#fca5a5"
              : isListening
              ? "#fcd34d"
              : LIGHT.border
          }`,
          color: busy
            ? "#2563eb"
            : isSpeaking
            ? "#047857"
            : listenMode === "active"
            ? "#dc2626"
            : isListening
            ? "#92400e"
            : LIGHT.textSecondary,
          fontSize: "0.88rem",
          fontWeight: 600,
          textAlign: "center",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          flexShrink: 0,
        }}
      >
        {/* Status line */}
        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
          {busy
            ? "⚙️ Lizzz is generating response..."
            : isSpeaking
            ? "🔊 Lizzz Speaking"
            : listenMode === "active"
            ? `🎙️ Command: "${interimTranscript || "Speak your question..."}"`
            : isListening
            ? `👂 Waiting for wake word... (say "Hello Assistant")`
            : "🟢 Handsfree ready — say \"Hello Assistant\" to start!"}
        </div>

        {/* Live captions while Lizzz speaks */}
        {isSpeaking && (
          <div
            ref={captionRef}
            style={{
              width: "100%",
              maxHeight: 56,
              overflowY: "auto",
              fontSize: "0.8rem",
              fontWeight: 400,
              lineHeight: 1.55,
              color: "#064e3b",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 10,
              padding: "0.4rem 0.7rem",
              textAlign: "left",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              boxSizing: "border-box",
            }}
          >
            {liveCaptionText || "..."}
          </div>
        )}

        {/* Stop Speaker Button */}
        <button
          type="button"
          onClick={onStopSpeaking}
          disabled={!isSpeaking}
          title={isSpeaking ? "Click to stop Lizzz from speaking" : "Speaker is currently idle"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.85rem",
            borderRadius: 10,
            border: `1px solid ${isSpeaking ? "#ef4444" : LIGHT.borderStrong}`,
            background: isSpeaking ? "#dc2626" : LIGHT.panel,
            color: isSpeaking ? "#ffffff" : LIGHT.textMuted,
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: isSpeaking ? "pointer" : "default",
            boxShadow: isSpeaking ? "0 2px 8px rgba(220,38,38,0.3)" : "none",
            opacity: isSpeaking ? 1 : 0.6,
            transition: "all 0.15s ease",
          }}
        >
          🛑 {isSpeaking ? "Stop Speaker Now" : "Stop Speaker"}
        </button>
      </div>
    </div>
  );
}
