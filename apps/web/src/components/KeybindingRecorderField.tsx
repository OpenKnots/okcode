import {
  keybindingValueFromShortcutEvent,
  parseKeybindingShortcut,
} from "@okcode/shared/keybindings";
import type * as React from "react";
import { useMemo, useState } from "react";

import { formatShortcutLabel } from "~/keybindings";
import { cn } from "~/lib/utils";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

function resolvePlatform(): string {
  return typeof navigator === "undefined" ? "unknown" : navigator.platform;
}

export function formatRecordedKeybindingValue(value: string, platform = resolvePlatform()): string {
  const shortcut = parseKeybindingShortcut(value);
  return shortcut ? formatShortcutLabel(shortcut, platform) : value;
}

export interface KeybindingRecorderFieldProps extends Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "readOnly" | "value"
> {
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
  readonly clearLabel?: string;
}

export function KeybindingRecorderField({
  value,
  onChange,
  placeholder = "Press shortcut",
  className,
  disabled,
  clearLabel = "Clear",
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: KeybindingRecorderFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const platform = resolvePlatform();
  const displayValue = useMemo(
    () => (value ? formatRecordedKeybindingValue(value, platform) : ""),
    [platform, value],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Tab") return;

    event.preventDefault();
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
    if ((event.key === "Backspace" || event.key === "Delete") && !hasModifier) {
      onChange("");
      return;
    }

    const nextValue = keybindingValueFromShortcutEvent(event, platform);
    if (!nextValue) return;
    onChange(nextValue);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        {...props}
        className="min-w-0 flex-1"
        disabled={disabled}
        placeholder={isFocused ? "Press shortcut now" : placeholder}
        readOnly
        value={displayValue}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onKeyDown={handleKeyDown}
      />
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={disabled || value.length === 0}
        onClick={() => onChange("")}
      >
        {clearLabel}
      </Button>
    </div>
  );
}
