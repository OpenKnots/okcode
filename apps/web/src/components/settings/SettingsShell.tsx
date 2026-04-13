import {
  CpuIcon,
  GitBranchIcon,
  KeyboardIcon,
  PaletteIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SmartphoneIcon,
  VariableIcon,
  WrenchIcon,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";

import { isElectron, isMobileShell } from "../../env";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset, SidebarTrigger } from "../ui/sidebar";
import { cn } from "../../lib/utils";
import { useT } from "../../i18n/useI18n";

export type SettingsSectionId =
  | "general"
  | "authentication"
  | "hotkeys"
  | "environment"
  | "git"
  | "models"
  | "mobile"
  | "advanced";

export type SettingsNavId = SettingsSectionId | "style";

interface SettingsNavItem {
  id: SettingsNavId;
  label: string;
  icon: ReactNode;
  hidden?: boolean;
}

const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { id: "general", label: "General", icon: <Settings2Icon className="size-4" /> },
  { id: "style", label: "Style", icon: <PaletteIcon className="size-4" /> },
  {
    id: "authentication",
    label: "Authentication",
    icon: <ShieldCheckIcon className="size-4" />,
  },
  { id: "hotkeys", label: "Hotkeys", icon: <KeyboardIcon className="size-4" /> },
  { id: "environment", label: "Environment", icon: <VariableIcon className="size-4" /> },
  { id: "git", label: "Git", icon: <GitBranchIcon className="size-4" /> },
  { id: "models", label: "Models", icon: <CpuIcon className="size-4" /> },
  {
    id: "mobile",
    label: "Mobile Companion",
    icon: <SmartphoneIcon className="size-4" />,
    hidden: isMobileShell,
  },
  { id: "advanced", label: "Advanced", icon: <WrenchIcon className="size-4" /> },
];

function SettingsNavSidebar({
  items,
  activeItem,
  onSelect,
}: {
  items: readonly SettingsNavItem[];
  activeItem: SettingsNavId;
  onSelect: (id: SettingsNavId) => void;
}) {
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-0.5 py-1" aria-label="Settings navigation">
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              activeItem === item.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => onSelect(item.id)}
            aria-current={activeItem === item.id ? "page" : undefined}
          >
            <span className="flex size-5 items-center justify-center opacity-70">{item.icon}</span>
            {item.label}
          </button>
        ))}
    </nav>
  );
}

export function SettingsShell({
  activeItem,
  changedSettingLabels,
  onRestoreDefaults,
  children,
}: {
  activeItem: SettingsNavId;
  changedSettingLabels: readonly string[];
  onRestoreDefaults: () => Promise<void>;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { t } = useT();
  const activeItemLabel = useMemo(
    () => SETTINGS_NAV_ITEMS.find((item) => item.id === activeItem)?.label ?? "Settings",
    [activeItem],
  );

  const handleSelect = (item: SettingsNavId) => {
    if (item === "style") {
      void navigate({ to: "/settings/style" });
      return;
    }

    if (item === "general") {
      void navigate({ to: "/settings", search: {} });
      return;
    }

    void navigate({ to: "/settings", search: { section: item } });
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border/60 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="size-7 shrink-0" />
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-medium text-foreground">Settings</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-muted-foreground">{activeItemLabel}</span>
              </div>
              <div className="ms-auto flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={changedSettingLabels.length === 0}
                  onClick={() => void onRestoreDefaults()}
                >
                  {t("common.actions.restoreDefaults")}
                </Button>
              </div>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border/60 px-5">
            <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide">
              <span className="text-muted-foreground/70">Settings</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-muted-foreground/70">{activeItemLabel}</span>
            </div>
            <div className="ms-auto flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={changedSettingLabels.length === 0}
                onClick={() => void onRestoreDefaults()}
              >
                {t("common.actions.restoreDefaults")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border/60 px-3 py-4 md:block">
            <SettingsNavSidebar
              items={SETTINGS_NAV_ITEMS}
              activeItem={activeItem}
              onSelect={handleSelect}
            />
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/60 px-4 py-2 md:hidden">
              <Select
                value={activeItem}
                onValueChange={(value) => handleSelect(value as SettingsNavId)}
              >
                <SelectTrigger className="w-full" aria-label="Settings section">
                  <SelectValue>{activeItemLabel}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {SETTINGS_NAV_ITEMS.filter((item) => !item.hidden).map((item) => (
                    <SelectItem hideIndicator key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl p-6 sm:p-8">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
