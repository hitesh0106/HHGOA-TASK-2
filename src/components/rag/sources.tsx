"use client";

import { BookOpen, ExternalLink } from "lucide-react";

export interface SourceRef {
  citation: number;
  docId: string;
  excerpt: string;
  score: number;
  language?: string;
}

interface SourcesProps {
  sources: SourceRef[];
  contextPreview?: string;
}

export function Sources({ sources, contextPreview }: SourcesProps) {
  if (sources.length === 0) return null;

  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
          <span className="eyebrow">Sources</span>
        </div>
        <span className="text-[11px] text-forest-500 dark:text-forest-400 tabular">
          {sources.length} cited
        </span>
      </div>

      <div className="space-y-2">
        {sources.map((s) => (
          <div
            key={s.citation}
            className="flex items-start gap-3 p-3 rounded-md bg-forest-50/40 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60 hover:bg-forest-50/70 dark:hover:bg-forest-900/40 transition-colors"
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-goa-gold-100 dark:bg-goa-gold-950/70 border border-goa-gold-300/40 dark:border-goa-gold-500/30 text-goa-gold-800 dark:text-goa-gold-300 text-[10px] font-semibold flex items-center justify-center tabular shadow-xs">
              C{s.citation}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-forest-500 dark:text-forest-400 truncate">
                  {s.docId}
                </span>
                <span className="chip chip-muted tabular ml-auto">
                  score {s.score.toFixed(3)}
                </span>
              </div>
              <p className="text-xs text-forest-700 dark:text-forest-200 leading-snug line-clamp-2">
                {s.excerpt}
              </p>
            </div>
          </div>
        ))}
      </div>

      {contextPreview && (
        <details className="mt-3 group">
          <summary className="text-[11px] text-forest-600 dark:text-forest-300 cursor-pointer hover:text-forest-800 dark:hover:text-forest-100 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            View full context window
          </summary>
          <pre className="mt-2 text-[10px] font-mono text-forest-600 dark:text-forest-300 whitespace-pre-wrap bg-forest-50/60 dark:bg-[#0c1813] p-3 rounded-md border border-forest-100 dark:border-forest-800/80 max-h-48 overflow-auto scroll-area-custom">
            {contextPreview}
          </pre>
        </details>
      )}
    </div>
  );
}
