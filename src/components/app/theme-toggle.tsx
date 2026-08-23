"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-4 w-4" />, label: "Light" },
    { value: "system", icon: <Monitor className="h-4 w-4" />, label: "System" },
    { value: "dark", icon: <Moon className="h-4 w-4" />, label: "Dark" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-none border border-border bg-surface-2 p-0.5" role="group" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          aria-label={o.label}
          aria-pressed={theme === o.value}
          title={o.label}
          className={cn(
            "rounded-none p-1.5 transition-colors",
            theme === o.value ? "bg-surface text-fg shadow-sm" : "text-faint hover:text-fg",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
