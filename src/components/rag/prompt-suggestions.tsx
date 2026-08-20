"use client";

import React from "react";
import { Sparkles, MessageSquare } from "lucide-react";

interface PromptSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const SAMPLE_PROMPTS = [
  { text: "What is a corporation?", lang: "en" },
  { text: "Does Delta Airlines fly to Bangalore?", lang: "en" },
  { text: "How fast does an eagle fly in normal flight?", lang: "en" },
  { text: "कॉरपोरेशन क्या है?", lang: "hi" },
];

export function PromptSuggestions({ onSelectPrompt, disabled = false }: PromptSuggestionsProps) {
  return (
    <div className="w-full max-w-xl mx-auto py-1">
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-forest-500 dark:text-forest-400 mb-2.5">
        <Sparkles className="w-3 h-3 text-goa-gold-500" />
        <span>Sample Questions</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SAMPLE_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(p.text)}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs border border-forest-200/80 dark:border-forest-800/80 bg-white/80 dark:bg-[#11231c]/80 hover:bg-forest-50 dark:hover:bg-[#162d24] text-forest-800 dark:text-forest-100 hover:border-forest-400 dark:hover:border-forest-600 transition-all duration-150 shadow-2xs hover:scale-[1.01] active:scale-99 cursor-pointer disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-2 truncate">
              <MessageSquare className="w-3.5 h-3.5 shrink-0 text-forest-400 dark:text-forest-500" />
              <span className="font-medium truncate">{p.text}</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-forest-100/70 dark:bg-forest-900/70 text-forest-600 dark:text-forest-300 font-mono shrink-0">
              {p.lang}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
