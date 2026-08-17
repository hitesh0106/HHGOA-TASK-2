"use client";

import { WaveformBars } from "./brand";

interface HeroProps {
  hasStarted: boolean;
}

export function Hero({ hasStarted }: HeroProps) {
  return (
    <section className="text-center pt-5 pb-3 max-w-2xl mx-auto">
      {/* Eyebrow chip */}
      <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-goa-gold-300/60 bg-goa-gold-50/80 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-goa-gold-500 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-goa-gold-900">
          HH Goa 2026 · Task 2 · Voice RAG
        </span>
      </div>

      {/* Main heading */}
      <h1 className="mt-2 font-serif text-2xl sm:text-3xl lg:text-4xl text-forest-950 leading-tight tracking-tight">
        Ask. Retrieve.{" "}
        <span className="relative inline-block">
          <span className="italic text-forest-800">Understand.</span>
          <svg
            className="absolute -bottom-1.5 left-0 w-full"
            viewBox="0 0 200 8"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M2 5 Q 50 1 100 4 T 198 3"
              stroke="var(--color-goa-gold-400)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-1.5 text-xs sm:text-sm text-forest-700/85 max-w-lg mx-auto leading-normal">
        Voice-enabled Retrieval Augmented Generation grounded in the MSMARCO-XI dataset.
      </p>

      {/* Status hint */}
      <div className="mt-2 flex items-center justify-center gap-2.5 text-[10px] text-forest-600 font-medium">
        <span className="flex items-center gap-1">
          <WaveformBars className="h-2.5 text-forest-600" bars={4} active={hasStarted} />
          {hasStarted ? "Pipeline Active" : "Ready for Query"}
        </span>
        <span className="opacity-40">·</span>
        <span className="tabular">Fast Local RAG (&le;50ms SLA Target) · Sarvam STT</span>
      </div>
    </section>
  );
}
