import * as React from "react";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";

/**
 * Executes a smooth circular reveal / ripple animation from the click position
 * while transitioning between Light and Dark mode.
 */
export function toggleThemeWithRipple(
  currentTheme: string | undefined,
  setTheme: (t: string) => void,
  event?: React.MouseEvent | MouseEvent
) {
  const isDark = currentTheme === "dark";
  const newTheme = isDark ? "light" : "dark";

  // If document.startViewTransition is not supported or user prefers reduced motion
  if (
    typeof document === "undefined" ||
    !("startViewTransition" in document) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setTheme(newTheme);
    return;
  }

  // Get coordinates of the user click or element center
  let x = window.innerWidth / 2;
  let y = 40;

  if (event) {
    if (event.clientX !== undefined && event.clientY !== undefined) {
      x = event.clientX;
      y = event.clientY;
    } else if (event.currentTarget && typeof (event.currentTarget as HTMLElement).getBoundingClientRect === "function") {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  // Calculate distance to the farthest corner of the viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // Trigger modern View Transition
  const transition = (document as any).startViewTransition(async () => {
    setTheme(newTheme);
  });

  transition.ready.then(() => {
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ];

    document.documentElement.animate(
      {
        clipPath: clipPath,
      },
      {
        duration: 480,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  });
}

/**
 * Direct 1-click Light/Dark theme toggle button with Sun/Moon icons
 * and animated circular wave transition.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="w-8 h-8 rounded-full flex items-center justify-center border border-forest-200/70 bg-forest-50/60 dark:border-forest-800/80 dark:bg-forest-950/60 text-forest-600 dark:text-forest-300 opacity-80"
        disabled
      >
        <span className="w-4 h-4" />
      </button>
    );
  }

  const activeTheme = resolvedTheme || theme || "light";
  const isDark = activeTheme === "dark";

  const handleToggle = (e: React.MouseEvent) => {
    toggleThemeWithRipple(activeTheme, setTheme, e);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      title={isDark ? "Switch to Light Mode (Click for circular transition)" : "Switch to Dark Mode (Click for circular transition)"}
      className={`w-8 h-8 rounded-full flex items-center justify-center border border-forest-200/70 bg-forest-50/60 hover:bg-forest-100/80 dark:border-forest-800/80 dark:bg-forest-950/60 dark:hover:bg-forest-900/80 text-forest-700 dark:text-forest-200 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 cursor-pointer shadow-xs ${className ?? ""}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-goa-gold-400 hover:text-goa-gold-300 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-forest-700 hover:text-forest-900 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
}
