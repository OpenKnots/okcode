import type {
  KeybindingCommand,
  KeybindingRule,
  ResolvedKeybindingsConfig,
  ServerConfigIssue,
} from "@okcode/contracts";
import {
  defaultKeybindingRulesForCommand,
  HOTKEY_COMMAND_DEFINITIONS,
  type HotkeyCommandDefinition,
  keybindingValuesForCommand,
  parseKeybindingShortcut,
} from "@okcode/shared/keybindings";
import { AlertTriangleIcon, KeyboardIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  KeybindingRecorderField,
  formatRecordedKeybindingValue,
} from "~/components/KeybindingRecorderField";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";

const MAX_EDITABLE_SHORTCUTS = 4;

interface DraftShortcutSlot {
  readonly id: string;
  readonly value: string;
}

function resolvePlatform(): string {
  return typeof navigator === "undefined" ? "unknown" : navigator.platform;
}

function normalizeShortcutValues(values: readonly string[]): string[] {
  const seenValues = new Set<string>();
  const normalizedValues: string[] = [];

  for (const value of values) {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) continue;
    if (!parseKeybindingShortcut(trimmedValue)) {
      throw new Error(`Invalid shortcut: ${trimmedValue}`);
    }
    if (seenValues.has(trimmedValue)) continue;
    seenValues.add(trimmedValue);
    normalizedValues.push(trimmedValue);
  }

  return normalizedValues;
}

function haveSameShortcutValues(left: readonly string[], right: readonly string[]): boolean {
  const normalizeForCompare = (values: readonly string[]) =>
    [...normalizeShortcutValues(values)].toSorted((first, second) => first.localeCompare(second));

  const normalizedLeft = normalizeForCompare(left);
  const normalizedRight = normalizeForCompare(right);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

function buildRulesForCommand(
  command: KeybindingCommand,
  values: readonly string[],
  when: string | undefined,
): KeybindingRule[] {
  return normalizeShortcutValues(values).map(
    (value) =>
      Object.assign({ key: value, command }, when ? { when } : {}) satisfies KeybindingRule,
  );
}

function labelsForValues(values: readonly string[], platform: string): string[] {
  return normalizeShortcutValues(values).map((value) =>
    formatRecordedKeybindingValue(value, platform),
  );
}

function createDraftShortcutSlot(value = ""): DraftShortcutSlot {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return { id, value };
}

interface HotkeysSettingsSectionProps {
  readonly keybindings: ResolvedKeybindingsConfig;
  readonly issues: readonly ServerConfigIssue[];
  readonly keybindingsConfigPath: string | null;
  readonly isOpeningKeybindings: boolean;
  readonly openKeybindingsError: string | null;
  readonly onOpenKeybindingsFile: () => void;
  readonly onReplaceKeybindingRules: (
    command: KeybindingCommand,
    rules: readonly KeybindingRule[],
  ) => Promise<void>;
}

interface HotkeyCommandState {
  readonly definition: HotkeyCommandDefinition;
  readonly currentValues: string[];
  readonly defaultValues: string[];
}

export function HotkeysSettingsSection({
  keybindings,
  issues,
  keybindingsConfigPath,
  isOpeningKeybindings,
  openKeybindingsError,
  onOpenKeybindingsFile,
  onReplaceKeybindingRules,
}: HotkeysSettingsSectionProps) {
  const platform = resolvePlatform();
  const [editingCommand, setEditingCommand] = useState<HotkeyCommandState | null>(null);
  const [draftShortcutSlots, setDraftShortcutSlots] = useState<DraftShortcutSlot[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasMalformedConfig = issues.some((issue) => issue.kind === "keybindings.malformed-config");
  const invalidEntryCount = issues.filter(
    (issue) => issue.kind === "keybindings.invalid-entry",
  ).length;
  const isEditingDisabled = hasMalformedConfig || isSaving;

  const commandStates = useMemo<HotkeyCommandState[]>(
    () =>
      HOTKEY_COMMAND_DEFINITIONS.map((definition) => {
        const currentValues = keybindingValuesForCommand(keybindings, definition.command);
        const defaultValues = defaultKeybindingRulesForCommand(definition.command).map(
          (rule) => rule.key,
        );
        return {
          definition,
          currentValues,
          defaultValues,
        };
      }),
    [keybindings],
  );

  const groupedCommandStates = useMemo(
    () => ({
      Workspace: commandStates.filter((state) => state.definition.group === "Workspace"),
      Terminal: commandStates.filter((state) => state.definition.group === "Terminal"),
    }),
    [commandStates],
  );

  const openEditor = (state: HotkeyCommandState) => {
    setEditingCommand(state);
    setDraftShortcutSlots(
      (state.currentValues.length > 0 ? state.currentValues : [""]).map((value) =>
        createDraftShortcutSlot(value),
      ),
    );
    setSaveError(null);
  };

  const closeEditor = () => {
    setEditingCommand(null);
    setDraftShortcutSlots([]);
    setSaveError(null);
  };

  const replaceShortcutValue = (slotId: string, nextValue: string) => {
    setDraftShortcutSlots((currentSlots) =>
      currentSlots.map((slot) => (slot.id === slotId ? { id: slot.id, value: nextValue } : slot)),
    );
  };

  const removeShortcutSlot = (slotId: string) => {
    setDraftShortcutSlots((currentSlots) => currentSlots.filter((slot) => slot.id !== slotId));
  };

  const addShortcutSlot = () => {
    setDraftShortcutSlots((currentSlots) =>
      currentSlots.length >= MAX_EDITABLE_SHORTCUTS
        ? currentSlots
        : [...currentSlots, createDraftShortcutSlot()],
    );
  };

  const saveShortcutRules = async () => {
    if (!editingCommand) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const rules = buildRulesForCommand(
        editingCommand.definition.command,
        draftShortcutSlots.map((slot) => slot.value),
        editingCommand.definition.when,
      );
      await onReplaceKeybindingRules(editingCommand.definition.command, rules);
      closeEditor();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save hotkeys.");
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefaults = async (definition: HotkeyCommandDefinition) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onReplaceKeybindingRules(definition.command, []);
      closeEditor();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to restore defaults.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderShortcutBadges = (values: readonly string[], emptyLabel: string) => {
    const labels = labelsForValues(values, platform);
    if (labels.length === 0) {
      return (
        <span className="text-xs text-muted-foreground" data-slot="hotkey-empty-state">
          {emptyLabel}
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <Badge key={label} variant="secondary" size="lg">
            {label}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Hotkeys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record, review, and restore the built-in keyboard shortcuts used across OK Code.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground">
        <div className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/80 p-3.5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <KeyboardIcon className="size-4 text-muted-foreground" />
                Recording
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Click <span className="font-medium text-foreground">Edit</span>, focus a shortcut
                field, and press the combination you want. Use at least one modifier. Plain{" "}
                <code>Backspace</code> or <code>Delete</code> clears a slot.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-3.5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <RotateCcwIcon className="size-4 text-muted-foreground" />
                Context rules
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Each command here keeps the same focus rules as the built-in defaults. Use{" "}
                <code>keybindings.json</code> below if you need custom <code>when</code> expressions
                or project-action bindings.
              </p>
            </div>
          </div>
        </div>

        {hasMalformedConfig ? (
          <div className="border-b border-border/60 px-4 py-4 sm:px-5">
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Hotkey editing is blocked</AlertTitle>
              <AlertDescription>
                <span>
                  <code>keybindings.json</code> is malformed, so OK Code can only fall back to the
                  built-in shortcuts right now.
                </span>
                <span>Fix the file first, then return here to record shortcuts.</span>
              </AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!keybindingsConfigPath || isOpeningKeybindings}
                  onClick={onOpenKeybindingsFile}
                >
                  {isOpeningKeybindings ? "Opening..." : "Open keybindings.json"}
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : null}

        {!hasMalformedConfig && invalidEntryCount > 0 ? (
          <div className="border-b border-border/60 px-4 py-4 sm:px-5">
            <Alert variant="warning">
              <AlertTriangleIcon />
              <AlertTitle>Some custom keybindings are invalid</AlertTitle>
              <AlertDescription>
                <span>
                  {invalidEntryCount} invalid entr{invalidEntryCount === 1 ? "y is" : "ies are"}{" "}
                  being ignored.
                </span>
                <span>
                  Saving from this screen keeps the valid rules and discards the broken ones.
                </span>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {(["Workspace", "Terminal"] as const).map((group) => (
          <div key={group}>
            <div className="border-b border-border/60 px-4 py-3 sm:px-5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {group}
              </span>
            </div>
            {groupedCommandStates[group].map((state) => {
              const currentLabels = labelsForValues(state.currentValues, platform);
              const defaultLabels = labelsForValues(state.defaultValues, platform);
              const isCustomized = !haveSameShortcutValues(
                state.currentValues,
                state.defaultValues,
              );
              return (
                <div
                  key={state.definition.command}
                  className="border-b border-border/60 px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">
                          {state.definition.title}
                        </h3>
                        <Badge variant={isCustomized ? "info" : "outline"}>
                          {isCustomized ? "Custom" : "Default"}
                        </Badge>
                        <Badge variant="outline">{state.definition.contextLabel}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {state.definition.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentLabels.length > 0 ? (
                          currentLabels.map((label) => (
                            <Badge key={label} variant="secondary" size="lg">
                              {label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No shortcut assigned.
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {isCustomized
                          ? `Defaults: ${defaultLabels.join(", ")}`
                          : "Using the built-in defaults."}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isCustomized ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => void restoreDefaults(state.definition)}
                        >
                          Restore defaults
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={isEditingDisabled}
                        onClick={() => openEditor(state)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">Advanced JSON</h3>
                <Badge variant="outline">Manual editing</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the persisted <code>keybindings.json</code> file to manage project-action
                bindings, custom <code>when</code> expressions, or anything more advanced than this
                screen supports.
              </p>
              <div className="mt-2 text-[11px] text-muted-foreground">
                <span className="block break-all font-mono text-foreground">
                  {keybindingsConfigPath ?? "Resolving keybindings path..."}
                </span>
                {openKeybindingsError ? (
                  <span className="mt-1 block text-destructive">{openKeybindingsError}</span>
                ) : (
                  <span className="mt-1 block">Opens in your preferred editor.</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!keybindingsConfigPath || isOpeningKeybindings}
                onClick={onOpenKeybindingsFile}
              >
                {isOpeningKeybindings ? "Opening..." : "Open keybindings.json"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={editingCommand !== null}
        onOpenChange={(open) => (!open ? closeEditor() : null)}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{editingCommand?.definition.title ?? "Edit hotkey"}</DialogTitle>
            <DialogDescription>
              {editingCommand?.definition.description}
              {editingCommand ? (
                <span className="mt-2 block text-xs text-muted-foreground">
                  Context: {editingCommand.definition.contextLabel}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-3">
              {draftShortcutSlots.map((slot, index) => (
                <div key={slot.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {index === 0 ? "Primary shortcut" : `Alternate ${index}`}
                    </div>
                    {draftShortcutSlots.length > 1 ? (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Remove shortcut ${index + 1}`}
                        disabled={isSaving}
                        onClick={() => removeShortcutSlot(slot.id)}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  <KeybindingRecorderField
                    autoFocus={index === 0}
                    value={slot.value}
                    onChange={(nextValue) => replaceShortcutValue(slot.id, nextValue)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 px-3.5 py-3">
              <p className="text-xs text-muted-foreground">
                Add up to {MAX_EDITABLE_SHORTCUTS} alternate shortcuts here. Use the JSON file for
                anything more complex.
              </p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={isSaving || draftShortcutSlots.length >= MAX_EDITABLE_SHORTCUTS}
                onClick={addShortcutSlot}
              >
                <PlusIcon className="size-3.5" />
                Add alternate
              </Button>
            </div>

            {editingCommand ? (
              <div className="rounded-xl border border-border/60 bg-muted/15 px-3.5 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Defaults
                </div>
                <div className="mt-2">
                  {renderShortcutBadges(editingCommand.defaultValues, "No default shortcut")}
                </div>
              </div>
            ) : null}

            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
          </DialogPanel>
          <DialogFooter>
            {editingCommand ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mr-auto"
                disabled={isSaving}
                onClick={() => void restoreDefaults(editingCommand.definition)}
              >
                Restore defaults
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={closeEditor}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void saveShortcutRules()}
            >
              {isSaving ? "Saving..." : "Save hotkeys"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
