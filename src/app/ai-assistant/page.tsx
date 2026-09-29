"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LIGHT } from "../zoho/_components/ui";
import {
  containsWakeWord,
  stripWakeWord,
  refineSpeechTranscript,
} from "./utils/speech-helpers";
import { HandsfreeGlobeCore } from "./components/HandsfreeGlobeCore";
import { ChatStreamPanel, type ChatMessage } from "./components/ChatStreamPanel";

const SILENCE_TIMEOUT_MS = 4000;

export default function AiAssistantPage() {
  const router = useRouter();
  const { status } = useSession();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handsfree, setHandsfree] = useState(true);
  const [listenMode, setListenMode] = useState<"idle" | "active">("idle");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [liveCaptionText, setLiveCaptionText] = useState("");
  const currentSpeakTextRef = useRef("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Wake word mode active! Say \"Hello Assistant\" to start — I won't listen to anything else.",
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechBufferRef = useRef<string>("");

  const handsfreeRef = useRef(true);
  const busyRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const listenModeRef = useRef<"idle" | "active">("idle");
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    handsfreeRef.current = handsfree;
  }, [handsfree]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    listenModeRef.current = listenMode;
  }, [listenMode]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const speakText = useCallback((text: string, onEndCallback?: () => void) => {
    if (!("speechSynthesis" in window)) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    currentSpeakTextRef.current = text;
    setLiveCaptionText("");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setLiveCaptionText(""); // start empty — grows word by word
    };

    // Accumulate only the already-spoken text (grows word by word)
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === "word") {
        const spokenSoFar = text.slice(0, event.charIndex + (event.charLength ?? 0)).trim();
        setLiveCaptionText(spokenSoFar);
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setLiveCaptionText("");
      currentSpeakTextRef.current = "";
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setLiveCaptionText("");
      currentSpeakTextRef.current = "";
      if (onEndCallback) onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setLiveCaptionText("");
    currentSpeakTextRef.current = "";
  }, []);

  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const processQuery = useCallback(
    async (rawText: string, isVoice: boolean = false) => {
      if (!rawText.trim() || busyRef.current) return;

      setInterimTranscript("");
      stopRecognition();
      setError(null);
      speechBufferRef.current = "";

      let refinedText = isVoice ? refineSpeechTranscript(rawText) : rawText;

      setBusy(true);
      if (isVoice) {
        try {
          const refineRes = await fetch("/api/assistant/refine-voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: refinedText }),
          });
          if (refineRes.ok) {
            const refineData = await refineRes.json();
            if (refineData.translatedText) {
              refinedText = refineData.translatedText;
            }
          }
        } catch (refineErr) {
          console.error("[AI Assistant UI] Error refining voice message:", refineErr);
        }
      }

      const userMsg: ChatMessage = { role: "user", content: refinedText, isVoice };
      const currentMessages = messagesRef.current;
      setMessages((m) => [...m, userMsg]);

      try {
        const historyPayload = currentMessages
          .filter((m: ChatMessage) => m.role === "user" || m.role === "assistant")
          .slice(-16)
          .map(({ role, content }: ChatMessage) => ({ role, content }));

        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: refinedText,
            history: historyPayload,
            isVoiceMessage: isVoice,
          }),
        });

        const data = (await res.json()) as { reply?: string; speakReply?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Request failed");
        }

        const reply = data.reply ?? "";
        const speakReply = data.speakReply ?? reply;

        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: reply,
          },
        ]);

        speakText(speakReply, () => {
          setBusy(false);
          if (handsfreeRef.current) {
            setTimeout(() => {
              startRecognition();
            }, 600);
          }
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Sorry — ${msg}` },
        ]);
        setBusy(false);
        if (handsfreeRef.current) {
          setTimeout(() => {
            startRecognition();
          }, 600);
        }
      }
    },
    [speakText, stopRecognition]
  );

  const startRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      if (busyRef.current || isSpeakingRef.current) return;

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + transcript;
        } else {
          interimTranscript += (interimTranscript ? " " : "") + transcript;
        }
      }

      if (listenModeRef.current === "idle") {
        const liveText = `${finalTranscript} ${interimTranscript}`.trim();
        if (!liveText) return;

        if (containsWakeWord(liveText)) {
          setListenMode("active");
          listenModeRef.current = "active";
          speechBufferRef.current = "";
          setInterimTranscript("");

          const commandAfterWake = stripWakeWord(liveText);
          if (commandAfterWake) {
            speechBufferRef.current = commandAfterWake;
            setInterimTranscript(commandAfterWake);

            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              const query = speechBufferRef.current.trim();
              if (query && !busyRef.current) {
                speechBufferRef.current = "";
                setInterimTranscript("");
                setListenMode("idle");
                listenModeRef.current = "idle";
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.onend = null;
                    recognitionRef.current.stop();
                  } catch {}
                  recognitionRef.current = null;
                }
                setIsListening(false);
                void processQuery(query, true);
              }
            }, SILENCE_TIMEOUT_MS);
          }
        }
        return;
      }

      if (finalTranscript) {
        const current = speechBufferRef.current.trim();
        if (!current) {
          speechBufferRef.current = finalTranscript;
        } else if (finalTranscript.startsWith(current)) {
          speechBufferRef.current = finalTranscript;
        } else if (!current.includes(finalTranscript)) {
          speechBufferRef.current += " " + finalTranscript;
        }
      }

      let liveTranscript = interimTranscript;
      if (!liveTranscript) {
        liveTranscript = speechBufferRef.current;
      } else if (
        speechBufferRef.current &&
        !liveTranscript.startsWith(speechBufferRef.current)
      ) {
        liveTranscript = speechBufferRef.current + " " + liveTranscript;
      }

      setInterimTranscript(liveTranscript.trim());
      clearSilenceTimer();

      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        const query = speechBufferRef.current.trim();
        if (query && !busyRef.current) {
          speechBufferRef.current = "";
          setInterimTranscript("");
          setInput("");
          setListenMode("idle");
          listenModeRef.current = "idle";
          if (recognitionRef.current) {
            try {
              recognitionRef.current.onend = null;
              recognitionRef.current.stop();
            } catch {}
            recognitionRef.current = null;
          }
          setIsListening(false);
          void processQuery(query, true);
        }
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error === "network") {
        console.warn("[Voice Assistant] Network error from Web Speech API. Retrying connection...");
        setError("Voice network error: Browser lost connection to speech recognition service. Retrying...");
        clearSilenceTimer();
        setIsListening(false);
        if (handsfreeRef.current && !busyRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (handsfreeRef.current && !recognitionRef.current) {
              setError(null);
              startRecognition();
            }
          }, 1500);
        }
        return;
      }
      if (event.error !== "aborted") {
        setError(`Voice error: ${event.error}`);
      }
      clearSilenceTimer();
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (busyRef.current || isSpeakingRef.current || !handsfreeRef.current) return;

      if (listenModeRef.current === "active") {
        setTimeout(() => {
          if (
            handsfreeRef.current &&
            !busyRef.current &&
            !isSpeakingRef.current &&
            !recognitionRef.current
          ) {
            startRecognition();
          }
        }, 150);
        return;
      }

      setTimeout(() => {
        if (
          handsfreeRef.current &&
          !busyRef.current &&
          !isSpeakingRef.current &&
          !recognitionRef.current
        ) {
          startRecognition();
        }
      }, 300);
    };

    try {
      recognition.start();
    } catch (e) {}
  }, [clearSilenceTimer, processQuery]);

  useEffect(() => {
    if (handsfree && !isListening && !busy && !isSpeaking) {
      startRecognition();
    }
    return () => {
      stopRecognition();
      clearSilenceTimer();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleHandsfreeMode = () => {
    if (handsfree) {
      setHandsfree(false);
      stopRecognition();
      clearSilenceTimer();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      setHandsfree(true);
      startRecognition();
    }
  };

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div
      className="assistant-container"
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "1.25rem",
        height: "calc(100vh - 75px)",
        maxHeight: "calc(100vh - 75px)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Top Header Bar */}
      <div
        className="header-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1.25rem",
          background: LIGHT.panel,
          border: `1px solid ${LIGHT.border}`,
          borderRadius: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.55rem 1.1rem",
            borderRadius: 10,
            border: `1px solid ${LIGHT.borderStrong}`,
            background: LIGHT.panel,
            color: LIGHT.text,
            fontWeight: 600,
            fontSize: "0.88rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          ← Back to Workspace
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${LIGHT.accent}, #7c3aed)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
            }}
          >
            🌍
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: LIGHT.text, margin: 0 }}>
              Lizzz Handsfree Voice Assistant
            </h1>
            <p style={{ fontSize: "0.78rem", color: LIGHT.textMuted, margin: 0 }}>
              Continuous Voice Control · Live Handsfree Speech
            </p>
          </div>
        </div>

        {/* Handsfree Toggle Button */}
        <button
          type="button"
          onClick={toggleHandsfreeMode}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.95rem",
            borderRadius: 20,
            border: `1px solid ${handsfree ? "#bbf7d0" : LIGHT.borderStrong}`,
            background: handsfree ? "#f0fdf4" : LIGHT.panel,
            color: handsfree ? "#16a34a" : LIGHT.textMuted,
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: busy
                ? "#2563eb"
                : isSpeaking
                ? "#10b981"
                : listenMode === "active"
                ? "#dc2626"
                : isListening
                ? "#f59e0b"
                : handsfree
                ? "#16a34a"
                : "#9ca3af",
              display: "inline-block",
              boxShadow: `0 0 8px ${
                busy
                  ? "#2563eb"
                  : isSpeaking
                  ? "#10b981"
                  : listenMode === "active"
                  ? "#dc2626"
                  : isListening
                  ? "#f59e0b"
                  : handsfree
                  ? "#16a34a"
                  : "#9ca3af"
              }`,
            }}
          />
          {busy
            ? "⚙️ Processing..."
            : isSpeaking
            ? "🔊 Lizzz Speaking..."
            : listenMode === "active"
            ? "🎙️ Command Active"
            : isListening
            ? "👂 Awaiting Wake Word"
            : handsfree
            ? "🟢 Handsfree ON"
            : "⚪ Handsfree OFF"}
        </button>
      </div>

      {/* Main Split Grid */}
      <div
        className="assistant-grid"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* LEFT COLUMN: Handsfree Globe Core */}
        <HandsfreeGlobeCore
          handsfree={handsfree}
          listenMode={listenMode}
          isListening={isListening}
          isSpeaking={isSpeaking}
          busy={busy}
          interimTranscript={interimTranscript}
          liveCaptionText={liveCaptionText}
          onToggleHandsfree={toggleHandsfreeMode}
          onStopSpeaking={stopSpeaking}
        />

        {/* RIGHT COLUMN: Scrollable Chat Stream */}
        <ChatStreamPanel
          messages={messages}
          busy={busy}
          isSpeaking={isSpeaking}
          error={error}
          input={input}
          onInputChange={setInput}
          onSend={(text) => void processQuery(text)}
        />
      </div>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 768px) {
          .assistant-container {
            height: auto !important;
            max-height: none !important;
            overflow-y: auto !important;
            padding: 0.75rem !important;
            gap: 0.75rem !important;
          }
          .header-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
            text-align: center !important;
          }
          .header-bar > div {
            justify-content: center !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 0.4rem !important;
          }
          .assistant-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto !important;
            height: auto !important;
            overflow: visible !important;
            gap: 0.75rem !important;
          }
          .left-column {
            height: 520px !important;
            flex-shrink: 0 !important;
            overflow-y: auto !important;
          }
          .right-column {
            height: 520px !important;
            flex-shrink: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
