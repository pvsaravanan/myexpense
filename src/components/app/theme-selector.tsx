"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Segmented } from "@/components/ui/segmented";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" strokeWidth={2.25} /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" strokeWidth={2.25} /> },
  { value: "system", label: "System", icon: <Monitor className="h-4 w-4" strokeWidth={2.25} /> },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <Segmented
      value={theme}
      onChange={(v) => setTheme(v as Theme)}
      options={OPTIONS}
      className="w-full sm:w-auto"
    />
  );
}
