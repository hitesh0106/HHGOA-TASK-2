"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

export interface UseThemeProps {
  themes: string[];
  setTheme: (theme: string | ((prev: string) => string)) => void;
  theme?: string;
  resolvedTheme?: string;
  systemTheme?: "dark" | "light";
}

const ThemeContext = createContext<UseThemeProps>({
  themes: ["light", "dark", "system"],
  setTheme: () => {},
  theme: "system",
  resolvedTheme: "dark",
  systemTheme: "dark",
});

export const useTheme = () => useContext(ThemeContext);

export interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  storageKey?: string;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  storageKey = "hhgoa-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<string>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      return localStorage.getItem(storageKey) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");

  // Track system preference
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = (e: MediaQueryList | MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    updateSystem(media);
    media.addEventListener("change", updateSystem);
    return () => media.removeEventListener("change", updateSystem);
  }, []);

  const resolvedTheme = useMemo(() => {
    if (theme === "system") return systemTheme;
    return theme === "dark" ? "dark" : "light";
  }, [theme, systemTheme]);

  // Apply to DOM without rendering unexecutable client script tags
  useEffect(() => {
    const root = document.documentElement;
    if (attribute === "class") {
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
    } else {
      root.setAttribute(attribute, resolvedTheme);
    }
  }, [resolvedTheme, attribute]);

  const setTheme = useCallback(
    (newTheme: string | ((prev: string) => string)) => {
      setThemeState((prev) => {
        const next = typeof newTheme === "function" ? newTheme(prev) : newTheme;
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  const value = useMemo(
    () => ({
      themes: ["light", "dark", "system"],
      setTheme,
      theme,
      resolvedTheme,
      systemTheme,
    }),
    [theme, resolvedTheme, systemTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
