import type { ReactNode } from "react";

interface FeatureCardProps {
  icon?: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}

export function FeatureCard({ icon, title, description, compact }: FeatureCardProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
        <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-6">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
