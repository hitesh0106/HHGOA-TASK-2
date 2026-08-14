"use client";

import { Mic, Database, Cpu, Layers, Activity } from "lucide-react";

interface SystemStatusProps {
  sarvamConfigured: boolean;
  vectorStoresLoaded: number;
  totalVectorStores: number;
  idfSize: number;
  docCount: number;
  uptime: number;
}

type Status = "online" | "warn" | "offline" | "idle";

interface StatusRow {
  label: string;
  icon: React.ReactNode;
  status: Status;
  detail: string;
}

export function SystemStatus({
  sarvamConfigured,
  vectorStoresLoaded,
  totalVectorStores,
  idfSize,
  docCount,
  uptime,
}: SystemStatusProps) {
  const allLoaded = vectorStoresLoaded === totalVectorStores;

  const rows: StatusRow[] = [
    {
      label: "Speech-to-Text",
      icon: <Mic className="w-3.5 h-3.5" />,
      status: sarvamConfigured ? "online" : "offline",
      detail: sarvamConfigured ? "Sarvam Saaras v3 · ready" : "API key not set",
    },
    {
      label: "Embeddings",
      icon: <Activity className="w-3.5 h-3.5" />,
      status: idfSize > 0 ? "online" : "offline",
      detail: idfSize > 0 ? `TF-IDF hash · ${idfSize.toLocaleString()} terms` : "Not loaded",
    },
    {
      label: "Vector Database",
      icon: <Database className="w-3.5 h-3.5" />,
      status: allLoaded ? "online" : vectorStoresLoaded > 0 ? "warn" : "offline",
      detail: `${vectorStoresLoaded}/${totalVectorStores} indices · ${docCount} docs`,
    },
    {
      label: "LLM",
      icon: <Cpu className="w-3.5 h-3.5" />,
      status: "online",
      detail: "GLM-4.5 · via z-ai-web-dev-sdk",
    },
    {
      label: "RAG Pipeline",
      icon: <Layers className="w-3.5 h-3.5" />,
      status: allLoaded && sarvamConfigured ? "online" : "warn",
      detail: allLoaded && sarvamConfigured ? "Ready" : "Partially ready",
    },
  ];

  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">System Status</span>
        <span className="text-[11px] text-forest-500 tabular">
          uptime {Math.round(uptime)}s
        </span>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-1.5 border-b border-forest-100 last:border-0"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-forest-500">{row.icon}</span>
              <span className="text-sm font-medium text-forest-800">{row.label}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-forest-500 tabular hidden sm:inline">
                {row.detail}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`status-dot ${row.status}`} />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-forest-600 w-12">
                  {row.status === "online"
                    ? "Online"
                    : row.status === "warn"
                    ? "Warn"
                    : row.status === "idle"
                    ? "Idle"
                    : "Offline"}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-forest-100 text-[10px] text-forest-400">
        API keys are loaded from environment variables and never exposed to the client.
      </div>
    </div>
  );
}
