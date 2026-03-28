import type React from "react";

export function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="text-foreground/80">{icon}</span>
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">{title}</h2>
          {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
