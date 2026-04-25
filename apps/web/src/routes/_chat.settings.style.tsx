import { createFileRoute } from "@tanstack/react-router";
import { GlobeIcon, ImportIcon } from "lucide-react";
import { useState } from "react";

import {
  DEFAULT_SIDEBAR_FONT_SIZE,
  DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT,
  DEFAULT_SIDEBAR_SPACING,
  DEFAULT_SIDEBAR_THREAD_ROW_HEIGHT,
  SIDEBAR_FONT_SIZE_MAX,
  SIDEBAR_FONT_SIZE_MIN,
  SIDEBAR_PROJECT_ROW_HEIGHT_MAX,
  SIDEBAR_PROJECT_ROW_HEIGHT_MIN,
  SIDEBAR_SPACING_MAX,
  SIDEBAR_SPACING_MIN,
  SIDEBAR_THREAD_ROW_HEIGHT_MAX,
  SIDEBAR_THREAD_ROW_HEIGHT_MIN,
} from "../appSettings";
import { CustomThemeDialog } from "../components/CustomThemeDialog";
import { SettingsShell } from "../components/settings/SettingsShell";
import {
  BackgroundImageSettings,
  SettingResetButton,
  SettingsRow,
  SettingsSection,
} from "../components/settings/SettingsUi";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import {
  CODE_FONTS,
  COLOR_THEMES,
  DEFAULT_CODE_FONT,
  DEFAULT_COLOR_THEME,
  DEFAULT_MESSAGE_FONT,
  MESSAGE_FONTS,
  getCodeFontStack,
  getMessageFontStack,
} from "../hooks/useTheme";
import { useSettingsRouteContext } from "../components/settings/SettingsRouteContext";
import {
  applyCustomTheme,
  clearStoredCustomTheme,
  getStoredCustomTheme,
  removeCustomTheme,
  type CustomThemeData,
} from "../lib/customTheme";
import { openUrlInAppBrowser } from "../lib/openUrlInAppBrowser";
import { readNativeApi, ensureNativeApi } from "../nativeApi";
import { useStore } from "../store";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";

const THEME_OPTIONS = [
  {
    value: "system",
    label: "System",
    description: "Match your OS appearance setting.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme.",
  },
] as const;

export const Route = createFileRoute("/_chat/settings/style")({
  component: SettingsStyleRouteView,
});

function SettingsStyleRouteView() {
  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    messageFont,
    setMessageFont,
    codeFont,
    setCodeFont,
    settingsState: { settings, defaults, updateSettings },
    radiusOverride,
    setRadiusOverride,
    fontOverride,
    setFontOverride,
    fontSizeOverride,
    setFontSizeOverride,
    changedSettingLabels,
    restoreDefaults,
  } = useSettingsRouteContext();
  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);
  const [customThemeDialogOpen, setCustomThemeDialogOpen] = useState(false);
  const activeProjectId = projects[0]?.id ?? null;
  const activeProjectPreviewThreadId =
    activeProjectId === null
      ? null
      : (threads
          .filter((thread) => thread.projectId === activeProjectId)
          .toSorted((a, b) =>
            (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
          )
          .at(0)?.id ?? null);

  const openTweakcn = async () => {
    try {
      await openUrlInAppBrowser({
        url: "https://tweakcn.com",
        projectId: activeProjectId,
        threadId: activeProjectPreviewThreadId,
        popOut: true,
        nativeApi: readNativeApi(),
      });
    } catch {
      const nativeApi = ensureNativeApi();
      await nativeApi.shell.openExternal("https://tweakcn.com");
    }
  };

  return (
    <SettingsShell
      activeItem="style"
      changedSettingLabels={changedSettingLabels}
      onRestoreDefaults={restoreDefaults}
    >
      <div className="space-y-10">
        <SettingsSection
          title="Style"
          description="Theme, typography, surfaces, and sidebar presentation."
        >
          <SettingsRow
            title="Theme"
            description="Choose how OK Code looks across the app."
            resetAction={
              theme !== "system" ? (
                <SettingResetButton label="theme" onClick={() => setTheme("system")} />
              ) : null
            }
            control={
              <Select
                value={theme}
                onValueChange={(value) => {
                  if (value !== "system" && value !== "light" && value !== "dark") return;
                  setTheme(value);
                }}
              >
                <SelectTrigger className="w-full sm:w-40" aria-label="Theme preference">
                  <SelectValue>
                    {THEME_OPTIONS.find((option) => option.value === theme)?.label ?? "System"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem hideIndicator key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            }
          />

          <SettingsRow
            title="Color theme"
            description="Pick a color palette for light and dark modes."
            resetAction={
              colorTheme !== DEFAULT_COLOR_THEME ? (
                <SettingResetButton
                  label="color theme"
                  onClick={() => {
                    setColorTheme(DEFAULT_COLOR_THEME);
                    clearStoredCustomTheme();
                    removeCustomTheme();
                  }}
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <Select
                  value={colorTheme}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      const existing = getStoredCustomTheme();
                      if (!existing) {
                        setCustomThemeDialogOpen(true);
                        return;
                      }
                    }
                    const match = COLOR_THEMES.find((themeOption) => themeOption.id === value);
                    if (!match) return;
                    setColorTheme(match.id);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40" aria-label="Color theme">
                    <SelectValue>
                      {COLOR_THEMES.find((themeOption) => themeOption.id === colorTheme)?.label ??
                        "Default"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {COLOR_THEMES.filter(
                      (themeOption) => themeOption.id !== "custom" || getStoredCustomTheme(),
                    ).map((themeOption) => (
                      <SelectItem hideIndicator key={themeOption.id} value={themeOption.id}>
                        {themeOption.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button size="xs" variant="outline" onClick={() => void openTweakcn()}>
                        <GlobeIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipPopup side="top">Open tweakcn in the in-app browser</TooltipPopup>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setCustomThemeDialogOpen(true)}
                      >
                        <ImportIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipPopup side="top">Import from tweakcn.com</TooltipPopup>
                </Tooltip>
              </div>
            }
          />

          <SettingsRow
            title="Message font"
            description="Typeface for chat messages and most UI text."
            resetAction={
              messageFont !== DEFAULT_MESSAGE_FONT ? (
                <SettingResetButton
                  label="message font"
                  onClick={() => setMessageFont(DEFAULT_MESSAGE_FONT)}
                />
              ) : null
            }
            control={
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Select
                  value={messageFont}
                  onValueChange={(value) => {
                    const match = MESSAGE_FONTS.find((family) => family.id === value);
                    if (!match) return;
                    setMessageFont(match.id);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48" aria-label="Message font">
                    <SelectValue>
                      {MESSAGE_FONTS.find((family) => family.id === messageFont)?.label ?? "Inter"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {MESSAGE_FONTS.map((family) => (
                      <SelectItem hideIndicator key={family.id} value={family.id}>
                        <span style={{ fontFamily: family.stack }}>{family.label}</span>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <span
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: getMessageFontStack(messageFont) }}
                >
                  The quick brown fox jumps over the lazy dog.
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Code font"
            description="Typeface for code blocks, diff viewer, terminal, and editor."
            resetAction={
              codeFont !== DEFAULT_CODE_FONT ? (
                <SettingResetButton
                  label="code font"
                  onClick={() => setCodeFont(DEFAULT_CODE_FONT)}
                />
              ) : null
            }
            control={
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Select
                  value={codeFont}
                  onValueChange={(value) => {
                    const match = CODE_FONTS.find((family) => family.id === value);
                    if (!match) return;
                    setCodeFont(match.id);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48" aria-label="Code font">
                    <SelectValue>
                      {CODE_FONTS.find((family) => family.id === codeFont)?.label ??
                        "JetBrains Mono"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {CODE_FONTS.map((family) => (
                      <SelectItem hideIndicator key={family.id} value={family.id}>
                        <span style={{ fontFamily: family.stack }}>{family.label}</span>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <span
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: getCodeFontStack(codeFont) }}
                >
                  const greet = (name) =&gt; `hi, ${"{"}name{"}"}`;
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Border radius"
            description="Adjust the corner roundness of UI elements."
            resetAction={
              radiusOverride !== null ? (
                <SettingResetButton label="border radius" onClick={() => setRadiusOverride(null)} />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.0625}
                  value={radiusOverride ?? 0.625}
                  onChange={(e) => {
                    setRadiusOverride(Number.parseFloat(e.target.value));
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Border radius"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {(radiusOverride ?? 0.625).toFixed(2)}rem
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Code font size"
            description="Adjust the font size for code editors and terminal."
            resetAction={
              fontSizeOverride !== null ? (
                <SettingResetButton
                  label="code font size"
                  onClick={() => setFontSizeOverride(null)}
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={20}
                  step={1}
                  value={fontSizeOverride ?? 12}
                  onChange={(e) => {
                    setFontSizeOverride(Number.parseFloat(e.target.value));
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Code font size"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {fontSizeOverride ?? 12}px
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Font family override"
            description="Override the UI font with any Google Font name."
            resetAction={
              fontOverride ? (
                <SettingResetButton
                  label="font family override"
                  onClick={() => setFontOverride("")}
                />
              ) : null
            }
            control={
              <Input
                className="w-full sm:w-48"
                value={fontOverride}
                onChange={(e) => setFontOverride(e.target.value)}
                placeholder="e.g. Inter, sans-serif"
                spellCheck={false}
                aria-label="Font family override"
              />
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Sidebar"
          description="Control density, accents, and background treatment for the navigation column."
        >
          <SettingsRow
            title="Sidebar opacity"
            description="Adjust the transparency of the side panel and project list."
            resetAction={
              settings.sidebarOpacity !== defaults.sidebarOpacity ? (
                <SettingResetButton
                  label="sidebar opacity"
                  onClick={() => updateSettings({ sidebarOpacity: defaults.sidebarOpacity })}
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={Math.round(settings.sidebarOpacity * 100)}
                  onChange={(e) => {
                    const value = Number(e.target.value) / 100;
                    updateSettings({ sidebarOpacity: value });
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Sidebar opacity"
                />
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round(settings.sidebarOpacity * 100)}%
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Project height"
            description="Adjust the height of project rows in the sidebar."
            resetAction={
              settings.sidebarProjectRowHeight !== defaults.sidebarProjectRowHeight ? (
                <SettingResetButton
                  label="project height"
                  onClick={() =>
                    updateSettings({
                      sidebarProjectRowHeight: DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={SIDEBAR_PROJECT_ROW_HEIGHT_MIN}
                  max={SIDEBAR_PROJECT_ROW_HEIGHT_MAX}
                  step={1}
                  value={settings.sidebarProjectRowHeight}
                  onChange={(e) => {
                    updateSettings({
                      sidebarProjectRowHeight: Number(e.target.value),
                    });
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Project height"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {settings.sidebarProjectRowHeight}px
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Thread height"
            description="Adjust the height of thread rows in the sidebar."
            resetAction={
              settings.sidebarThreadRowHeight !== defaults.sidebarThreadRowHeight ? (
                <SettingResetButton
                  label="thread height"
                  onClick={() =>
                    updateSettings({
                      sidebarThreadRowHeight: DEFAULT_SIDEBAR_THREAD_ROW_HEIGHT,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={SIDEBAR_THREAD_ROW_HEIGHT_MIN}
                  max={SIDEBAR_THREAD_ROW_HEIGHT_MAX}
                  step={1}
                  value={settings.sidebarThreadRowHeight}
                  onChange={(e) => {
                    updateSettings({
                      sidebarThreadRowHeight: Number(e.target.value),
                    });
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Thread height"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {settings.sidebarThreadRowHeight}px
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Sidebar font size"
            description="Adjust the size of project and thread names in the sidebar."
            resetAction={
              settings.sidebarFontSize !== defaults.sidebarFontSize ? (
                <SettingResetButton
                  label="sidebar font size"
                  onClick={() => updateSettings({ sidebarFontSize: DEFAULT_SIDEBAR_FONT_SIZE })}
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={SIDEBAR_FONT_SIZE_MIN}
                  max={SIDEBAR_FONT_SIZE_MAX}
                  step={1}
                  value={settings.sidebarFontSize}
                  onChange={(e) => {
                    updateSettings({ sidebarFontSize: Number(e.target.value) });
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Sidebar font size"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {settings.sidebarFontSize}px
                </span>
              </div>
            }
          />

          <SettingsRow
            title="Sidebar spacing"
            description="Adjust padding and row spacing in the project and thread list."
            resetAction={
              settings.sidebarSpacing !== defaults.sidebarSpacing ? (
                <SettingResetButton
                  label="sidebar spacing"
                  onClick={() => updateSettings({ sidebarSpacing: DEFAULT_SIDEBAR_SPACING })}
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={SIDEBAR_SPACING_MIN}
                  max={SIDEBAR_SPACING_MAX}
                  step={1}
                  value={settings.sidebarSpacing}
                  onChange={(e) => {
                    updateSettings({ sidebarSpacing: Number(e.target.value) });
                  }}
                  className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                  aria-label="Sidebar spacing"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {settings.sidebarSpacing}px
                </span>
              </div>
            }
          />

          <BackgroundImageSettings
            backgroundImageOpacity={settings.backgroundImageOpacity}
            backgroundImageUrl={settings.backgroundImageUrl}
            defaultBackgroundImageOpacity={defaults.backgroundImageOpacity}
            defaultBackgroundImageUrl={defaults.backgroundImageUrl}
            updateSettings={updateSettings}
          />

          <SettingsRow
            title="Accent project names"
            description="Use the theme's accent color for project names in the sidebar."
            resetAction={
              settings.sidebarAccentProjectNames !== defaults.sidebarAccentProjectNames ? (
                <SettingResetButton
                  label="accent project names"
                  onClick={() =>
                    updateSettings({
                      sidebarAccentProjectNames: defaults.sidebarAccentProjectNames,
                    })
                  }
                />
              ) : null
            }
            control={
              <Switch
                checked={settings.sidebarAccentProjectNames}
                onCheckedChange={(checked) =>
                  updateSettings({
                    sidebarAccentProjectNames: Boolean(checked),
                  })
                }
                aria-label="Accent project names"
              />
            }
          />

          <SettingsRow
            title="Accent color override"
            description="Set a custom color for accented project names instead of the theme default."
            resetAction={
              settings.sidebarAccentColorOverride ? (
                <SettingResetButton
                  label="accent color override"
                  onClick={() =>
                    updateSettings({
                      sidebarAccentColorOverride: undefined,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <label
                  className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
                  style={{
                    backgroundColor:
                      settings.sidebarAccentColorOverride || "var(--accent-foreground)",
                  }}
                >
                  <input
                    type="color"
                    value={settings.sidebarAccentColorOverride || "#000000"}
                    onChange={(e) =>
                      updateSettings({
                        sidebarAccentColorOverride: e.target.value,
                      })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Accent color picker"
                  />
                </label>
                <input
                  type="text"
                  value={settings.sidebarAccentColorOverride ?? ""}
                  placeholder="Theme default"
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateSettings({
                      sidebarAccentColorOverride: value || undefined,
                    });
                  }}
                  className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring sm:w-32"
                  aria-label="Accent color value"
                />
              </div>
            }
          />

          <SettingsRow
            title="Accent background override"
            description="Set a custom background color for project headers instead of the theme default."
            resetAction={
              settings.sidebarAccentBgColorOverride ? (
                <SettingResetButton
                  label="accent background override"
                  onClick={() =>
                    updateSettings({
                      sidebarAccentBgColorOverride: undefined,
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <label
                  className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
                  style={{
                    backgroundColor: settings.sidebarAccentBgColorOverride || "var(--accent)",
                  }}
                >
                  <input
                    type="color"
                    value={settings.sidebarAccentBgColorOverride || "#000000"}
                    onChange={(e) =>
                      updateSettings({
                        sidebarAccentBgColorOverride: e.target.value,
                      })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Accent background color picker"
                  />
                </label>
                <input
                  type="text"
                  value={settings.sidebarAccentBgColorOverride ?? ""}
                  placeholder="Theme default"
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateSettings({
                      sidebarAccentBgColorOverride: value || undefined,
                    });
                  }}
                  className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring sm:w-32"
                  aria-label="Accent background color value"
                />
              </div>
            }
          />
        </SettingsSection>

        <CustomThemeDialog
          open={customThemeDialogOpen}
          onOpenChange={setCustomThemeDialogOpen}
          onApply={(themeData: CustomThemeData) => {
            applyCustomTheme(themeData);
            setColorTheme("custom");
          }}
        />
      </div>
    </SettingsShell>
  );
}
