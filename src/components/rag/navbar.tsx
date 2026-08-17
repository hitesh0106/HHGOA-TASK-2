"use client";

import { HHGoaMark, WaveformBars } from "./brand";

interface NavbarProps {
  active: "voice" | "evaluation" | "system";
  onNavigate: (tab: "voice" | "evaluation" | "system") => void;
  systemOnline: boolean;
}

export function Navbar({ active, onNavigate, systemOnline }: NavbarProps) {
  const navItems: Array<{ id: NavbarProps["active"]; label: string }> = [
    { id: "voice", label: "Voice RAG" },
    { id: "evaluation", label: "Evaluation" },
    { id: "system", label: "System" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-forest-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: brand */}
        <div className="flex items-center gap-3">
          <div className="text-forest-700">
            <HHGoaMark className="w-8 h-8" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-forest-800 tracking-tight">
              Voice RAG
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-goa-gold-600 font-medium">
              HH Goa 2026 · Task 2
            </div>
          </div>
        </div>

        {/* Center: nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button suppressHydrationWarning
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                active === item.id
                  ? "bg-forest-800 text-forest-50"
                  : "text-forest-600 hover:bg-forest-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            <WaveformBars className="text-forest-500 h-3" bars={4} />
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-forest-200/70 bg-forest-50/60">
            <span className={`status-dot ${systemOnline ? "online" : "offline"}`} />
            <span className="text-[11px] font-medium text-forest-700 tabular">
              {systemOnline ? "System Online" : "System Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-forest-200/60 px-4 py-2 flex gap-1">
        {navItems.map((item) => (
          <button suppressHydrationWarning
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-full transition-colors ${
              active === item.id
                ? "bg-forest-800 text-forest-50"
                : "text-forest-600 hover:bg-forest-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
