"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Sell Up storefront theme provider (Phase 2.2a).
 *
 * Supports light / dark / system theme modes, persisted in localStorage and
 * synced with the `dark` class on <html> and the `color-scheme` CSS property.
 * Safe for server-side rendering: renders children without a theme class on
 * the server, then hydrates on the client to avoid hydration mismatch.
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "sellup:storefront:theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? getSystemTheme() : mode;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
}

interface ThemeContextValue {
  mode: ThemeMode;
  theme: "light" | "dark";
  setTheme: (next: ThemeMode) => void;
  mounted: boolean;
}

const themeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultMode = "light",
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);
  const [storedMode, setStoredMode] = useState<ThemeMode | null>(null);

  // Read persisted theme on the client after mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "light" || raw === "dark" || raw === "system") {
        setStoredMode(raw);
      } else {
        setStoredMode(defaultMode);
      }
    } catch {
      setStoredMode(defaultMode);
    }
    setMounted(true);
  }, [storageKey, defaultMode]);

  const mode: ThemeMode = storedMode ?? defaultMode;
  const theme = resolveTheme(mode);

  // Apply the `dark` class and color-scheme whenever theme or mount changes.
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
      html.style.colorScheme = "dark";
    } else {
      html.classList.remove("dark");
      html.style.colorScheme = "light";
    }
  }, [theme, mounted]);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      setStoredMode(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // localStorage unavailable; theme still applies for this session.
      }
    },
    [storageKey]
  );

  return (
    <themeContext.Provider value={{ mode, theme, setTheme, mounted }}>
      {children}
    </themeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(themeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
