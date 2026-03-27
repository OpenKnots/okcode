import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { cn } from "../lib/utils";

type Mode = "system" | "light" | "dark";

const MODES: { value: Mode; icon: typeof MonitorIcon; label: string }[] = [
  { value: "system", icon: MonitorIcon, label: "System" },
  { value: "light", icon: SunIcon, label: "Light" },
  { value: "dark", icon: MoonIcon, label: "Dark" },
];

export function ThemeModeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-7 items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {MODES.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            className={cn(
              "flex h-6 flex-1 items-center justify-center rounded-md text-muted-foreground transition-colors",
              isActive
                ? "bg-background text-foreground shadow-xs"
                : "hover:text-foreground/80",
            )}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
