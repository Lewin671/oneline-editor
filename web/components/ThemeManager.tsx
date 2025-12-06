"use client";

import { getStoredThemeMode } from "@/lib/theme";
import { useEditorStore } from "@/lib/store";
import { useEffect } from "react";

export function ThemeManager() {
  const { themeMode, setThemeMode, setResolvedTheme } = useEditorStore();

  useEffect(() => {
    const storedMode = getStoredThemeMode() ?? "auto";
    setThemeMode(storedMode);
  }, [setThemeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (themeMode !== "auto") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setResolvedTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [themeMode, setResolvedTheme]);

  return null;
}
