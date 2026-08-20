"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles } from "lucide-react";

export type PortalState = "idle" | "listening" | "transcribing" | "processing" | "ready";

interface VoiceWavePortalProps {
  state: PortalState;
  transcript?: string;
  sttLatencyMs?: number | null;
  error?: string | null;
  onStart: () => void;
  onStop: () => void;
  compact?: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
  waveIndex: number;
}

export function VoiceWavePortal({
  state,
  transcript,
  sttLatencyMs,
  error,
  onStart,
  onStop,
  compact = false,
  className = "",
}: VoiceWavePortalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const isListening = state === "listening";
  const isWorking = state === "transcribing" || state === "processing";
  const isReady = state === "ready";

  // Check user motion preferences
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const handleClick = () => {
    if (isListening) {
      onStop();
    } else if (!isWorking) {
      onStart();
    }
  };

  // Canvas wave ribbon animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayH = compact ? 140 : 180;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    let height = (canvas.height = displayH);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = canvas.parentElement.clientWidth;
      const displayHeight = compact ? 140 : 180;

      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      ctx.scale(dpr, dpr);
      width = displayWidth;
      height = displayHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Initialize travelling retrieval particles
    const particleCount = 14;
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
      x: (width / particleCount) * i + Math.random() * 20,
      y: height / 2,
      speed: 0.6 + Math.random() * 0.8,
      size: 1.2 + Math.random() * 1.8,
      alpha: 0.3 + Math.random() * 0.5,
      waveIndex: i % 3,
    }));

    const render = () => {
      timeRef.current += isListening ? 0.045 : isWorking ? 0.03 : 0.015;
      const t = timeRef.current;

      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;

      // Color palettes based on active class
      const goldStroke = isDark ? "rgba(243, 195, 92, 0.75)" : "rgba(217, 148, 32, 0.75)";
      const goldGlow = isDark ? "rgba(243, 195, 92, 0.25)" : "rgba(217, 148, 32, 0.15)";
      const emeraldStroke = isDark ? "rgba(82, 183, 136, 0.55)" : "rgba(53, 97, 70, 0.5)";
      const emeraldFill = isDark ? "rgba(18, 56, 38, 0.2)" : "rgba(227, 236, 228, 0.4)";
      const sageStroke = isDark ? "rgba(156, 184, 173, 0.3)" : "rgba(106, 151, 120, 0.35)";

      // Amplitude dynamic scale based on state
      const baseAmp = (isListening ? 22 : isWorking ? 16 : 10) * (compact ? 0.85 : 1.0);

      // Layer 1: Wide Emerald Ambient Ribbon (Voice Input Boundary)
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const envelope = Math.sin((x / width) * Math.PI); // tapering ends
        const y =
          centerY +
          Math.sin(x * 0.012 + t * 1.1) * baseAmp * 0.9 * envelope +
          Math.cos(x * 0.024 - t * 0.7) * (baseAmp * 0.4) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = emeraldFill;
      ctx.fill();

      // Layer 2: Sage Harmonic Wave (Retrieval Vector Manifold)
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const envelope = Math.sin((x / width) * Math.PI);
        const y =
          centerY +
          Math.sin(x * 0.018 - t * 1.4) * (baseAmp * 0.75) * envelope +
          Math.sin(x * 0.035 + t * 0.9) * (baseAmp * 0.3) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = sageStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Layer 3: Central Emerald Pulse Wave (Semantic Embedding)
      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const envelope = Math.sin((x / width) * Math.PI);
        const y =
          centerY +
          Math.sin(x * 0.015 + t * 1.3) * baseAmp * envelope +
          Math.cos(x * 0.028 + t * 0.8) * (baseAmp * 0.45) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = emeraldStroke;
      ctx.lineWidth = isListening ? 2.2 : 1.6;
      ctx.stroke();

      // Layer 4: Gleaming Gold Crest Wave (Grounded Knowledge Trajectory)
      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const envelope = Math.sin((x / width) * Math.PI);
        const y =
          centerY +
          Math.cos(x * 0.014 + t * 1.6) * (baseAmp * 0.85) * envelope +
          Math.sin(x * 0.032 - t * 1.1) * (baseAmp * 0.35) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = goldStroke;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = goldGlow;
      ctx.shadowBlur = isDark ? 8 : 5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Layer 5: Travelling Retrieval Spark Particles
      if (!reducedMotion) {
        particlesRef.current.forEach((p, idx) => {
          p.x += p.speed * (isListening ? 2 : isWorking ? 1.5 : 1);
          if (p.x > width) p.x = 0;

          const envelope = Math.sin((p.x / width) * Math.PI);
          const py =
            centerY +
            Math.cos(p.x * 0.014 + t * 1.6) * (baseAmp * 0.85) * envelope +
            Math.sin(p.x * 0.032 - t * 1.1) * (baseAmp * 0.35) * envelope;

          ctx.beginPath();
          ctx.arc(p.x, py, p.size, 0, Math.PI * 2);
          ctx.fillStyle =
            idx % 2 === 0
              ? isDark
                ? "#f3c35c"
                : "#d99420"
              : isDark
              ? "#52b788"
              : "#356146";
          ctx.globalAlpha = p.alpha * envelope;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });
      }

      if (!reducedMotion) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [compact, isListening, isWorking, reducedMotion]);

  const statusLabel: Record<PortalState, string> = {
    idle: "Tap to speak",
    listening: "Listening… tap when finished",
    transcribing: "Transcribing voice via Sarvam AI…",
    processing: "Retrieving grounded knowledge…",
    ready: "Tap to speak",
  };

  return (
    <div className={`relative w-full max-w-3xl mx-auto flex flex-col items-center select-none ${className}`}>
      {/* 1. Atmospheric Ambient Radial Glow Underneath */}
      <div className="portal-ambient-glow absolute inset-0 pointer-events-none -z-10 transition-opacity duration-700" />

      {/* 2. Floating Animated Waveform Ribbon Surface */}
      <div className={`relative w-full flex items-center justify-center overflow-hidden ${
        compact ? "h-[130px] sm:h-[140px]" : "h-[160px] sm:h-[180px]"
      }`}>
        {/* Canvas wave oscillators */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Faint side fade masks */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none" />

        {/* 3. Central Interactive Microphone Orb */}
        <div className="relative z-10 flex items-center justify-center">
          {/* Outer Wave Pulse Rings (Only during active recording) */}
          {isListening && (
            <>
              <span className="wave-ring text-rose-500" />
              <span className="wave-ring text-rose-500 delay-1" />
              <span className="wave-ring text-goa-gold-400 delay-2" />
            </>
          )}

          {/* Golden Vortex Ring (During transcription / RAG synthesis) */}
          {(isWorking || isReady) && (
            <div
              className="absolute -inset-2 rounded-full border border-goa-gold-400/60 dark:border-goa-gold-400/80 animate-spin"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, var(--accent) 120deg, transparent 240deg)",
                WebkitMask: "radial-gradient(transparent 58%, black 60%)",
                mask: "radial-gradient(transparent 58%, black 60%)",
                animationDuration: "2.2s",
              }}
            />
          )}

          {/* Ambient Breathing Ring (Idle state) */}
          {!isListening && !isWorking && (
            <div className="absolute -inset-1.5 rounded-full border border-forest-300/40 dark:border-forest-700/50 animate-pulse pointer-events-none" />
          )}

          {/* Primary Interactive Mic Button */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={handleClick}
            disabled={isWorking}
            aria-label={isListening ? "Stop recording voice" : "Start speaking voice query"}
            title={isListening ? "Stop recording voice" : "Tap to speak your question"}
            className={`
              relative z-20 rounded-full flex items-center justify-center
              transition-all duration-300 active:scale-95 cursor-pointer
              disabled:opacity-75 disabled:cursor-not-allowed
              backdrop-blur-md
              ${compact ? "w-16 h-16 sm:w-18 sm:h-18" : "w-18 h-18 sm:w-20 sm:h-20"}
              ${
                isListening
                  ? "bg-rose-600 text-white shadow-[0_0_30px_rgba(225,29,72,0.65)] animate-pulse"
                  : isWorking
                  ? "bg-goa-gold-400 text-forest-950 shadow-[0_0_25px_rgba(217,148,32,0.55)]"
                  : "bg-forest-800 dark:bg-[#12271e] text-white shadow-[0_8px_25px_-5px_rgba(11,29,20,0.5)] dark:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.85)] hover:bg-forest-900 dark:hover:bg-[#18362a] hover:scale-105 border border-forest-600/40 dark:border-forest-500/40"
              }
            `}
          >
            {/* Inner Golden Precision Trim */}
            <span
              className={`absolute inset-1.5 rounded-full border pointer-events-none transition-colors duration-300 ${
                isListening
                  ? "border-rose-300/50"
                  : isWorking
                  ? "border-forest-950/30"
                  : "border-goa-gold-300/40 dark:border-goa-gold-400/45"
              }`}
            />

            {/* Central Icon */}
            {isWorking ? (
              <Loader2 className={`${compact ? "w-5 h-5" : "w-6 h-6"} animate-spin text-forest-950`} />
            ) : isListening ? (
              <Square className={`${compact ? "w-4 h-4" : "w-5 h-5"} fill-current text-white`} />
            ) : (
              <Mic className={`${compact ? "w-6 h-6" : "w-7 h-7"} text-forest-50 dark:text-emerald-100 transition-transform group-hover:scale-110`} />
            )}
          </button>
        </div>
      </div>

      {/* 4. Status Subtext & Feedback */}
      <div className="mt-0.5 text-center space-y-0.5">
        <div className="text-[11px] sm:text-xs font-medium text-forest-800 dark:text-forest-100 flex items-center justify-center gap-2">
          {isListening && (
            <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Recording active · speak clearly
            </span>
          )}
          {isWorking && (
            <span className="inline-flex items-center gap-1.5 text-goa-gold-700 dark:text-goa-gold-400 font-semibold">
              <Sparkles className="w-3 h-3 animate-spin" />
              {statusLabel[state]}
            </span>
          )}
          {!isListening && !isWorking && (
            <span className="text-forest-600 dark:text-forest-400">
              {statusLabel[state]}
            </span>
          )}
        </div>

        {/* Real-time speech telemetry */}
        {typeof sttLatencyMs === "number" && !isWorking && !isListening && (
          <div className="text-[10px] text-forest-500 dark:text-forest-400 tabular">
            Last voice latency: {sttLatencyMs.toFixed(0)}ms (Sarvam Saaras v3)
          </div>
        )}
      </div>

      {/* 5. Error Banner if microphone access or network fails */}
      {error && (
        <div className="mt-2 px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs shadow-xs animate-shake">
          {error}
        </div>
      )}
    </div>
  );
}
