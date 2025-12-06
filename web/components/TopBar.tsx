"use client";

import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Laptop, Moon, SunMedium } from "lucide-react";

const themeOptions = [
  { value: "light", label: "Light", icon: SunMedium },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "auto", label: "Auto", icon: Laptop },
] as const;

export function TopBar() {
  const { themeMode, resolvedTheme, setThemeMode } = useEditorStore();

  return (
    <div className="flex h-14 items-center gap-4 border-b bg-card/80 px-4 text-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-base font-semibold text-white shadow-sm">
          OE
        </div>
        <div className="leading-tight">
          <div className="font-semibold">Online Editor</div>
          <div className="text-xs text-muted-foreground">Workspace controls</div>
        </div>
      </div>

      <div className="hidden h-8 w-px bg-border md:block" />

      <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
        <span className="rounded-full border bg-muted/50 px-3 py-1 font-medium text-foreground">
          Project
        </span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1">
        <span className="px-2 text-xs font-medium text-muted-foreground">
          Theme
        </span>
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = themeMode === option.value;
          return (
            <button
              key={option.value}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-2 text-xs transition",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
              onClick={() => setThemeMode(option.value)}
              aria-pressed={isActive}
              type="button"
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{option.label}</span>
              {option.value === "auto" && (
                <span className="text-[11px] text-primary-foreground/80">
                  {resolvedTheme}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
