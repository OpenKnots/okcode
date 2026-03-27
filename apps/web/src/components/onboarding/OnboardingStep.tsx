import type { ReactNode } from "react";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";
import type { OnboardingStepConfig } from "./onboardingSteps";

const ACCENT_STYLES: Record<string, { icon: string; dot: string }> = {
  primary: {
    icon: "bg-primary/10 text-primary",
    dot: "bg-primary/60",
  },
  sky: {
    icon: "bg-sky-500/10 text-sky-500",
    dot: "bg-sky-500/60",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-500",
    dot: "bg-emerald-500/60",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-500",
    dot: "bg-amber-500/60",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-500",
    dot: "bg-violet-500/60",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-500",
    dot: "bg-rose-500/60",
  },
  orange: {
    icon: "bg-orange-500/10 text-orange-500",
    dot: "bg-orange-500/60",
  },
};

export function OnboardingStep({ step, icon }: { step: OnboardingStepConfig; icon: ReactNode }) {
  const accent = ACCENT_STYLES[step.accentColor] ?? ACCENT_STYLES.primary;

  return (
    <div className="flex flex-col items-center text-center">
      <div className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${accent.icon}`}>
        {icon}
      </div>

      <DialogTitle className="text-xl font-semibold tracking-tight">{step.title}</DialogTitle>

      <DialogDescription className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </DialogDescription>

      <ul className="mt-5 w-full max-w-sm space-y-2.5 text-left">
        {step.details.map((detail) => (
          <li
            key={detail}
            className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/80"
          >
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${accent.dot}`} />
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
