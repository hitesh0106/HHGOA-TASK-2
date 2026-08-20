"use client";

import React from "react";
import { motion } from "framer-motion";

interface VoiceRAGHeroProps {
  hasStarted?: boolean;
}

export function VoiceRAGHero({ hasStarted = false }: VoiceRAGHeroProps) {
  return (
    <section
      className={`relative w-full flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-300 ${
        hasStarted ? "pt-2 pb-1 sm:pt-3 sm:pb-1" : "pt-4 pb-2 sm:pt-6 sm:pb-3"
      }`}
    >
      {/* 1. Small Premium Eyebrow (0.1s entrance) */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full border border-goa-gold-300/60 dark:border-goa-gold-500/30 bg-goa-gold-50/80 dark:bg-goa-gold-950/40 shadow-xs mb-1.5 sm:mb-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-goa-gold-500 dark:bg-goa-gold-400 animate-pulse" />
        <span className="text-[10px] sm:text-[10.5px] font-semibold tracking-[0.18em] uppercase text-goa-gold-900 dark:text-goa-gold-300">
          HH GOA 2026 · TASK 2 · VOICE RAG
        </span>
      </motion.div>

      {/* 2. Main Headline with Sequenced Word Stagger (0.2s, 0.32s, 0.45s) */}
      <h1
        className={`font-serif text-forest-950 dark:text-forest-50 tracking-tight leading-[1.15] max-w-2xl px-4 flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 ${
          hasStarted ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
        }`}
      >
        {/* "Ask." (0.2s) */}
        <motion.span
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.35, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block text-forest-950 dark:text-forest-50 font-normal"
        >
          Ask.
        </motion.span>

        {/* "Retrieve." (0.32s) */}
        <motion.span
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.35, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block text-forest-900 dark:text-forest-100 font-normal"
        >
          Retrieve.
        </motion.span>

        {/* "Understand." (0.45s with Gold Underline Draw) */}
        <motion.span
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.35, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative inline-block italic font-normal text-forest-800 dark:text-forest-200"
        >
          Understand.
          {/* Animated Gold Underline Path */}
          <svg
            className="absolute -bottom-1 left-0 w-full h-2 pointer-events-none"
            viewBox="0 0 200 8"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <motion.path
              d="M2 5 Q 50 1 100 4 T 198 3"
              stroke="var(--accent)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5, ease: "easeInOut" }}
            />
          </svg>
        </motion.span>
      </h1>

      {/* 3. Subtitle (0.55s fade in) */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mt-1.5 sm:mt-2 text-xs sm:text-[13px] text-forest-700/85 dark:text-forest-300/85 max-w-md mx-auto px-4 leading-relaxed font-normal"
      >
        Voice-enabled Retrieval Augmented Generation grounded in the MSMARCO-XI dataset.
      </motion.p>
    </section>
  );
}
