"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeChoice) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem("patch-theme");
    const initialTheme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    applyTheme(initialTheme);
    const update = window.setTimeout(() => setThemeState(initialTheme), 0);
    return () => window.clearTimeout(update);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme(theme);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeChoice) => {
    setThemeState(nextTheme);
    window.localStorage.setItem("patch-theme", nextTheme);
    applyTheme(nextTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
