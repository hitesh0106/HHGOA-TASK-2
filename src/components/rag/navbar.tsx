"use client";

import { useTheme } from "@/components/theme-provider";
import { HHGoaMark, WaveformBars } from "./brand";
import { ThemeToggle, toggleThemeWithRipple } from "@/components/theme-toggle";

interface NavbarProps {
  active: "voice" | "evaluation" | "system";
  onNavigate: (tab: "voice" | "evaluation" | "system") => void;
  systemOnline: boolean;
}

export function Navbar({ active, onNavigate, systemOnline }: NavbarProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const navItems: Array<{ id: NavbarProps["active"]; label: string }> = [
    { id: "voice", label: "Voice RAG" },
    { id: "evaluation", label: "Evaluation" },
    { id: "system", label: "System" },
  ];

  const handleLogoClick = (e: React.MouseEvent) => {
    toggleThemeWithRipple(resolvedTheme || theme, setTheme, e);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#09140f]/90 backdrop-blur-md border-b border-forest-200/60 dark:border-forest-800/60 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Interactive brand logo with 1-click circular theme transition */}
        <button
          type="button"
          onClick={handleLogoClick}
          title="Click logo to toggle Dark/Light mode with circular wave animation"
          className="flex items-center gap-3 cursor-pointer group text-left p-1 rounded-xl hover:bg-forest-50/60 dark:hover:bg-forest-950/60 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
        >
          <div className="text-forest-700 dark:text-forest-300 group-hover:scale-105 transition-transform duration-200">
            <HHGoaMark className="w-8 h-8" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-forest-800 dark:text-forest-100 tracking-tight flex items-center gap-1.5">
              <span>Voice RAG</span>
              <span className="text-[9px] font-mono font-normal opacity-0 group-hover:opacity-100 text-forest-500 dark:text-forest-400 transition-opacity">
                (toggle theme)
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-goa-gold-600 dark:text-goa-gold-400 font-medium">
              HH Goa 2026 · Task 2
            </div>
          </div>
        </button>

        {/* Center: nav tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-forest-50/60 dark:bg-forest-950/50 p-1 rounded-full border border-forest-200/50 dark:border-forest-800/50">
          {navItems.map((item) => (
            <button suppressHydrationWarning
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-150 cursor-pointer ${
                active === item.id
                  ? "bg-forest-800 text-white dark:bg-forest-700 dark:text-white shadow-xs"
                  : "text-forest-600 dark:text-forest-300 hover:bg-forest-100/80 dark:hover:bg-forest-900/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: theme toggle + status */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <WaveformBars className="text-forest-500 dark:text-forest-400 h-3" bars={4} />
          </div>

          {/* Direct 1-Click Theme Toggle with Circular Ripple */}
          <ThemeToggle />

          {/* System Online Status Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-forest-200/70 bg-forest-50/60 dark:border-forest-800/70 dark:bg-forest-950/60 shadow-xs">
            <span className={`status-dot ${systemOnline ? "online" : "offline"}`} />
            <span className="text-[11px] font-medium text-forest-700 dark:text-forest-200 tabular">
              {systemOnline ? "System Online" : "System Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-forest-200/60 dark:border-forest-800/60 px-4 py-2 flex gap-1 bg-white/90 dark:bg-[#09140f]/95">
        {navItems.map((item) => (
          <button suppressHydrationWarning
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-full transition-colors ${
              active === item.id
                ? "bg-forest-800 text-white dark:bg-forest-700 dark:text-white shadow-xs"
                : "text-forest-600 dark:text-forest-300 hover:bg-forest-100 dark:hover:bg-forest-900/60"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
