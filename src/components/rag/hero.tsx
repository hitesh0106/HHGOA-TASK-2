"use client";

import { WaveformBars } from "./brand";

interface HeroProps {
  hasStarted: boolean;
}

export function Hero({ hasStarted }: HeroProps) {
  return (
    <section className="text-center pt-10 sm:pt-14 pb-8 sm:pb-10 max-w-3xl mx-auto">
      {/* Eyebrow chip */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-goa-gold-300/60 bg-goa-gold-50/80">
        <span className="w-1 h-1 rounded-full bg-goa-gold-500" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-goa-gold-800">
          HH Goa 2026 · AI Lab
        </span>
      </div>

      {/* Main heading */}
      <h1 className="mt-5 font-serif text-4xl sm:text-5xl lg:text-6xl text-forest-900 leading-[1.05] tracking-tight">
        Ask. Retrieve.
        <br />
        <span className="relative inline-block">
          <span className="italic text-forest-700">Understand.</span>
          <svg
            className="absolute -bottom-2 left-0 w-full"
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
      <p className="mt-6 text-sm sm:text-base text-forest-700/85 max-w-xl mx-auto leading-relaxed">
        Voice-enabled retrieval augmented generation, grounded in real knowledge
        from the MSMARCO-XI dataset by AI4Bharat.
      </p>

      {/* Status hint */}
      <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-forest-500">
        <span className="flex items-center gap-1.5">
          <WaveformBars className="h-3 text-forest-500" bars={4} active={hasStarted} />
          {hasStarted ? "Pipeline active" : "Awaiting input"}
        </span>
        <span className="opacity-40">·</span>
        <span className="tabular">Sarvam Saaras v3 · Sarvam-105B</span>
      </div>
    </section>
  );
}
