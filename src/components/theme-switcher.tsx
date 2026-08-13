"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "torrijos-theme";
const OPTIONS: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/**
 * Selector de tema (claro/oscuro/sistema) con persistencia en localStorage.
 * Por defecto arranca en "Claro". El script del layout raíz aplica la
 * preferencia guardada antes del primer paint para evitar el flash.
 */
export function ThemeSwitcher() {
  const [mode, setMode] = useState<Mode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light" || raw === "system") setMode(raw);
  }, []);

  function apply(next: Mode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    const dark =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  return (
    <div
      role="radiogroup"
      aria-label="Modo de color"
      className="glass-soft inline-flex gap-1 p-1"
    >
      {OPTIONS.map((o) => {
        const active = mounted && mode === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => apply(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-accent text-on-accent shadow-[0_6px_16px_rgba(31,108,92,0.25)]"
                : "text-ink-soft hover:bg-black/5",
            )}
          >
            <Icon className="h-4 w-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
