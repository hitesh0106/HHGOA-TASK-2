/**
 * HH Goa 2026 brand mark — a minimal palm + soundwave glyph.
 * Used in the navbar and hero.
 */
export function HHGoaMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer ring - forest green */}
      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      {/* Sun glow - gold */}
      <circle cx="20" cy="20" r="6" fill="var(--color-goa-gold-400)" opacity="0.85" />
      {/* Palm silhouette - forest */}
      <path
        d="M20 6 C 22 12, 22 16, 20 22 C 18 16, 18 12, 20 6 Z"
        fill="currentColor"
      />
      <path
        d="M20 11 C 14 9, 11 11, 9 14 C 13 13, 16 13, 20 14 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M20 11 C 26 9, 29 11, 31 14 C 27 13, 24 13, 20 14 Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Soundwave bars below */}
      <rect x="13" y="28" width="1.5" height="4" rx="0.5" fill="currentColor" />
      <rect x="16.5" y="26" width="1.5" height="6" rx="0.5" fill="currentColor" />
      <rect x="20" y="24" width="1.5" height="8" rx="0.5" fill="currentColor" />
      <rect x="23.5" y="26" width="1.5" height="6" rx="0.5" fill="currentColor" />
      <rect x="27" y="28" width="1.5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Inline waveform — animated bars used in hero / processing states.
 */
export function WaveformBars({
  className = "",
  bars = 5,
  active = false,
}: {
  className?: string;
  bars?: number;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-end gap-0.5 h-3 ${active ? "" : "opacity-40"} ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`block w-0.5 rounded-full bg-current ${active ? "animate-pulse" : ""}`}
          style={{
            height: `${30 + ((i * 17) % 70)}%`,
            animationDelay: `${i * 0.12}s`,
            animationDuration: `${0.9 + (i % 3) * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}
