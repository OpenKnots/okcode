import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-primary to-[hsl(223_82%_62%)] text-primary-foreground shadow-[0_18px_45px_-20px_hsl(var(--primary)/0.85)] hover:brightness-110 hover:shadow-[0_22px_55px_-22px_hsl(var(--primary)/0.95)]",
        destructive:
          "bg-linear-to-b from-destructive to-[hsl(352_72%_52%)] text-destructive-foreground shadow-[0_18px_45px_-20px_hsl(var(--destructive)/0.7)] hover:brightness-105 hover:shadow-[0_22px_55px_-22px_hsl(var(--destructive)/0.8)]",
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
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? (React.Fragment as never) : "button";

  if (asChild) {
    const child = React.Children.only(props.children) as React.ReactElement;
    return React.cloneElement(child, {
      ...props,
      className: cn(buttonVariants({ variant, size, className }), child.props.className),
    });
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
