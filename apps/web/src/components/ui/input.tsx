"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import type * as React from "react";

import { cn } from "~/lib/utils";

type InputSize = "sm" | "default" | "lg" | number;

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  nativeInput?: boolean;
  size?: InputSize;
  unstyled?: boolean;
};

function inputFieldClassName(size: InputSize) {
  return cn(
    "w-full min-w-0 rounded-[inherit] bg-transparent outline-none placeholder:text-muted-foreground/65",
    size === "sm" && "h-8 px-[calc(--spacing(2.5)-1px)] text-sm",
    size === "default" && "h-9 px-[calc(--spacing(3)-1px)] text-base sm:h-8 sm:text-sm",
    size === "lg" && "h-10 px-[calc(--spacing(3)-1px)] text-base sm:h-9 sm:text-sm",
    typeof size === "number" && "px-[calc(--spacing(3)-1px)]",
  );
}

function Input({
  className,
  type,
  size = "default",
  nativeInput = false,
  unstyled = false,
  ...props
}: InputProps) {
  const inputProps = {
    ...props,
    size: typeof size === "number" ? size : undefined,
    type,
  };

  if (nativeInput) {
    return (
      <input
        className={cn(inputFieldClassName(size), className)}
        data-size={typeof size === "string" ? size : undefined}
        data-slot="input"
        {...inputProps}
      />
    );
  }

  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-[box-shadow,border-color] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          className,
        ) || undefined
      }
      data-size={typeof size === "string" ? size : undefined}
      data-slot="input-control"
    >
      <FieldPrimitive.Control
        render={(defaultProps) => (
          <input
            className={inputFieldClassName(size)}
            data-slot="input"
            {...mergeProps<"input">(defaultProps, inputProps)}
          />
        )}
      />
    </span>
  );
}

export { Input, type InputProps };
