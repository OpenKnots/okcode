import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-primary to-[hsl(223_82%_62%)] text-button-primary-foreground shadow-[0_18px_45px_-20px_color-mix(in_srgb,var(--primary)_85%,transparent)] hover:brightness-110 hover:shadow-[0_22px_55px_-22px_color-mix(in_srgb,var(--primary)_95%,transparent)]",
        destructive:
          "bg-linear-to-b from-destructive to-[hsl(352_72%_52%)] text-button-destructive-foreground shadow-[0_18px_45px_-20px_color-mix(in_srgb,var(--destructive)_70%,transparent)] hover:brightness-105 hover:shadow-[0_22px_55px_-22px_color-mix(in_srgb,var(--destructive)_80%,transparent)]",
        "destructive-outline":
          "border border-destructive/35 bg-destructive/6 text-destructive shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] hover:border-destructive/45 hover:bg-destructive/10 hover:text-destructive",
        outline:
          "border border-border/80 bg-card/70 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] hover:border-primary/30 hover:bg-accent/80 hover:text-foreground",
        secondary:
          "bg-accent/85 text-accent-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent/75 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-7 rounded-lg px-2.5 text-[11px]",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-xl px-6",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-7 rounded-lg",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends useRender.ComponentProps<"button">, VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  return useRender({
    defaultTagName: "button",
    props: {
      ...props,
      className: cn(buttonVariants({ variant, size, className })),
      "data-slot": "button",
    },
    render,
  });
}

export { Button, buttonVariants };
