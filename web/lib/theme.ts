export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme-preference";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark" || value === "auto";

export const getStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return isThemeMode(value) ? value : null;
};

export const saveThemeMode = (mode: ThemeMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
};

export const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === "auto") {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  return mode;
};

export const applyResolvedTheme = (theme: ResolvedTheme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
};
