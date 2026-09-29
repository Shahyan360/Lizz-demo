"use client";

import { useEffect, useRef } from "react";

interface WaveformCanvasProps {
  listenMode: "idle" | "active";
  isListening: boolean;
  isSpeaking: boolean;
  busy: boolean;
}

export function WaveformCanvas({
  listenMode,
  isListening,
  isSpeaking,
  busy,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      ctx.beginPath();
      ctx.lineWidth = listenMode === "active" ? 3.5 : isSpeaking ? 3 : isListening ? 2 : 1.5;
      ctx.strokeStyle =
        listenMode === "active"
          ? "#ef4444"
          : isSpeaking
          ? "#10b981"
          : busy
          ? "#3b82f6"
          : isListening
          ? "#f59e0b"
          : "rgba(99, 102, 241, 0.4)";

      const amplitude =
        listenMode === "active" ? 28 : isSpeaking ? 20 : busy ? 12 : isListening ? 8 : 5;
      const frequency = listenMode === "active" ? 0.06 : isSpeaking ? 0.04 : 0.02;

      for (let x = 0; x < width; x++) {
        const y =
          height / 2 +
          Math.sin(x * frequency + step) * amplitude * Math.sin((x / width) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      step += listenMode === "active" ? 0.14 : isSpeaking ? 0.08 : isListening ? 0.06 : 0.04;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isListening, isSpeaking, busy, listenMode]);

  return (
    <div style={{ width: "100%", maxWidth: 360, zIndex: 2 }}>
      <canvas ref={canvasRef} width={360} height={42} style={{ width: "100%", height: 42 }} />
    </div>
  );
}
