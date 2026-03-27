import { useState } from "react";
import {
  FileDiffIcon,
  GitBranchIcon,
  ListChecksIcon,
  MessageSquareIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { Dialog, DialogFooter, DialogHeader, DialogPopup } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { OnboardingStep } from "./OnboardingStep";
import { ONBOARDING_STEPS } from "./onboardingSteps";
import { useOnboardingState } from "./useOnboardingState";

const STEP_ICONS = [
  <SparklesIcon key="sparkles" className="size-7" />,
  <MessageSquareIcon key="message" className="size-7" />,
  <GitBranchIcon key="git" className="size-7" />,
  <FileDiffIcon key="diff" className="size-7" />,
  <TerminalSquareIcon key="terminal" className="size-7" />,
  <ListChecksIcon key="plan" className="size-7" />,
  <ShieldCheckIcon key="shield" className="size-7" />,
  <RocketIcon key="rocket" className="size-7" />,
];

export function OnboardingDialog() {
  const { open, complete, skip } = useOnboardingState();
  const [step, setStep] = useState(0);

  if (!open) return null;

  const totalSteps = ONBOARDING_STEPS.length;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const currentStep = ONBOARDING_STEPS[step]!;

  const handleNext = () => {
    if (isLast) {
      complete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) skip();
      }}
    >
      <DialogPopup showCloseButton={false} className="max-w-xl">
        <DialogHeader className="px-8 pt-8 pb-2">
          <div key={step} className="animate-in fade-in duration-300">
            <OnboardingStep step={currentStep} icon={STEP_ICONS[step]} />
          </div>
        </DialogHeader>

        <DialogFooter
          variant="bare"
          className="flex-row items-center justify-between px-8 pt-4 pb-8"
        >
          {/* Step indicator dots */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Onboarding progress">
            {ONBOARDING_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1} of ${totalSteps}: ${s.title}`}
                aria-current={i === step ? "step" : undefined}
                className={`size-2 rounded-full transition-all duration-200 ${
                  i === step
                    ? "scale-125 bg-primary"
                    : i < step
                      ? "bg-primary/40 hover:bg-primary/60"
                      : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={skip}>
                Skip
              </Button>
            )}
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLast ? "Get Started" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
