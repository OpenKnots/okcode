import { EyeIcon, EyeOffIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import {
  ENVIRONMENT_VARIABLE_KEY_MAX_LENGTH,
  ENVIRONMENT_VARIABLE_MAX_COUNT,
  ENVIRONMENT_VARIABLE_VALUE_MAX_LENGTH,
  type EnvironmentVariableEntry,
} from "@okcode/contracts";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { cn } from "~/lib/utils";

type DraftRow = {
  readonly id: string;
  key: string;
  value: string;
};

function createDraftRow(entry?: EnvironmentVariableEntry): DraftRow {
  return {
    id: crypto.randomUUID(),
    key: entry?.key ?? "",
    value: entry?.value ?? "",
  };
}

function rowsFromEntries(entries: ReadonlyArray<EnvironmentVariableEntry>): DraftRow[] {
  return entries.map((entry) => createDraftRow(entry));
}

function normalizeRows(rows: ReadonlyArray<DraftRow>): EnvironmentVariableEntry[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) continue;
    byKey.set(key, row.value);
  }
  return [...byKey.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, value }));
}

function serializeEntries(entries: ReadonlyArray<EnvironmentVariableEntry>): string {
  return JSON.stringify(entries);
}

function validateRow(
  row: DraftRow,
  keyCounts: Map<string, number>,
): { key?: string; value?: string } {
  const key = row.key.trim();
  const errors: { key?: string; value?: string } = {};

  if (key.length === 0) {
    if (row.value.length > 0) {
      errors.key = "A variable name is required.";
    }
    return errors;
  }

  if (key.length > ENVIRONMENT_VARIABLE_KEY_MAX_LENGTH) {
    errors.key = `Keys must be ${ENVIRONMENT_VARIABLE_KEY_MAX_LENGTH} characters or less.`;
  } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    errors.key = "Use letters, numbers, and underscores, starting with a letter or underscore.";
  } else if ((keyCounts.get(key) ?? 0) > 1) {
    errors.key = "This variable name is duplicated.";
  }

  if (row.value.length > ENVIRONMENT_VARIABLE_VALUE_MAX_LENGTH) {
    errors.value = `Values must be ${ENVIRONMENT_VARIABLE_VALUE_MAX_LENGTH} characters or less.`;
  }

  return errors;
}

function validateRows(
  rows: ReadonlyArray<DraftRow>,
): Map<string, { key?: string; value?: string }> {
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.key.trim();
    if (key.length === 0) continue;
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const errors = new Map<string, { key?: string; value?: string }>();
  for (const row of rows) {
    const rowErrors = validateRow(row, keyCounts);
    if (rowErrors.key || rowErrors.value) {
      errors.set(row.id, rowErrors);
    }
  }
  return errors;
}

function hasDraftMeaningfulContent(row: DraftRow): boolean {
  return row.key.trim().length > 0 || row.value.length > 0;
}

export interface EnvironmentVariablesEditorProps {
  readonly description: ReactNode;
  readonly entries: ReadonlyArray<EnvironmentVariableEntry>;
  readonly emptyMessage: string;
  readonly saveButtonLabel: string;
  readonly addButtonLabel: string;
  readonly onSave: (
    entries: ReadonlyArray<EnvironmentVariableEntry>,
  ) => Promise<ReadonlyArray<EnvironmentVariableEntry>>;
  readonly disabled?: boolean;
}

export function EnvironmentVariablesEditor({
  description,
  entries,
  emptyMessage,
  saveButtonLabel,
  addButtonLabel,
  onSave,
  disabled = false,
}: EnvironmentVariablesEditorProps) {
  const [rows, setRows] = useState<DraftRow[]>(() => rowsFromEntries(entries));
  const [visibleValueRowIds, setVisibleValueRowIds] = useState<Set<string>>(() => new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setRows(rowsFromEntries(entries));
    setVisibleValueRowIds(new Set());
    setSaveError(null);
  }, [entries]);

  const normalizedEntries = normalizeRows(rows);
  const hasChanges = serializeEntries(normalizedEntries) !== serializeEntries(entries);
  const rowErrors = validateRows(rows);
  const isValid = rowErrors.size === 0;
  const isReadonly = disabled || isSaving;
  const canAddRow = !isReadonly && rows.length < ENVIRONMENT_VARIABLE_MAX_COUNT;
  const canSave = !isReadonly && hasChanges && isValid;

  const updateRow = (rowId: string, patch: Partial<Pick<DraftRow, "key" | "value">>) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    setSaveError(null);
  };

  const toggleValueVisibility = (rowId: string) => {
    setVisibleValueRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const addRow = () => {
    if (!canAddRow) return;
    setRows((current) => [...current, createDraftRow()]);
    setSaveError(null);
  };

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setVisibleValueRowIds((current) => {
      if (!current.has(rowId)) return current;
      const next = new Set(current);
      next.delete(rowId);
      return next;
    });
    setSaveError(null);
  };

  const resetRows = () => {
    setRows(rowsFromEntries(entries));
    setVisibleValueRowIds(new Set());
    setSaveError(null);
  };

  const saveRows = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const savedEntries = await onSave(normalizedEntries);
      setRows(rowsFromEntries(savedEntries));
      setVisibleValueRowIds(new Set());
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save environment variables.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          <p className="text-[11px] text-muted-foreground/80">
            Values are encrypted at rest before they are written to the local state database.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!hasChanges || isReadonly}
            onClick={resetRows}
          >
            Discard
          </Button>
          <Button type="button" size="xs" disabled={!canSave} onClick={() => void saveRows()}>
            {isSaving ? "Saving..." : saveButtonLabel}
          </Button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {saveError}
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-5 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : null}

        {rows.map((row, index) => {
          const errors = rowErrors.get(row.id);
          const isBlank = !hasDraftMeaningfulContent(row);
          const isValueVisible = visibleValueRowIds.has(row.id);
          const valueFieldId = `env-var-value-${row.id}`;
          const valueMaskStyle = {
            WebkitTextSecurity: isValueVisible ? "none" : "disc",
          } as CSSProperties & {
            WebkitTextSecurity?: string;
          };
          return (
            <div
              key={row.id}
              className={cn(
                "rounded-xl border bg-card/70 p-3 shadow-xs/5",
                errors ? "border-destructive/30" : "border-border/70",
              )}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)]">
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-foreground">Key {index + 1}</span>
                  <Input
                    value={row.key}
                    disabled={isReadonly}
                    onChange={(event) => updateRow(row.id, { key: event.target.value })}
                    placeholder="API_KEY"
                    maxLength={ENVIRONMENT_VARIABLE_KEY_MAX_LENGTH}
                    spellCheck={false}
                    aria-invalid={errors?.key ? "true" : undefined}
                  />
                  {errors?.key ? (
                    <span className="block text-[11px] text-destructive">{errors.key}</span>
                  ) : null}
                </label>

                <div className="block space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      className="block text-xs font-medium text-foreground"
                      htmlFor={valueFieldId}
                    >
                      Value
                    </label>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            className="size-6 rounded-md text-muted-foreground hover:text-foreground"
                            aria-label={isValueVisible ? "Hide value" : "Show value"}
                            aria-pressed={isValueVisible}
                            disabled={isReadonly}
                            onClick={() => toggleValueVisibility(row.id)}
                          >
                            {isValueVisible ? (
                              <EyeOffIcon className="size-3.5" />
                            ) : (
                              <EyeIcon className="size-3.5" />
                            )}
                          </Button>
                        }
                      />
                      <TooltipPopup side="top">
                        {isValueVisible ? "Hide value" : "Show value"}
                      </TooltipPopup>
                    </Tooltip>
                  </div>
                  <Textarea
                    id={valueFieldId}
                    value={row.value}
                    disabled={isReadonly}
                    onChange={(event) => updateRow(row.id, { value: event.target.value })}
                    placeholder="secret value"
                    maxLength={ENVIRONMENT_VARIABLE_VALUE_MAX_LENGTH}
                    rows={3}
                    spellCheck={false}
                    aria-invalid={errors?.value ? "true" : undefined}
                    className="resize-y"
                    style={valueMaskStyle}
                  />
                  {errors?.value ? (
                    <span className="block text-[11px] text-destructive">{errors.value}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {isBlank
                    ? "Blank rows are ignored until they contain a key."
                    : "This value will be available to launches in the matching scope."}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={isReadonly}
                  aria-label="Remove variable"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          {normalizedEntries.length}/{ENVIRONMENT_VARIABLE_MAX_COUNT} saved variables
        </div>
        <Button type="button" size="xs" variant="outline" disabled={!canAddRow} onClick={addRow}>
          <PlusIcon className="size-3.5" />
          {addButtonLabel}
        </Button>
      </div>
    </div>
  );
}
