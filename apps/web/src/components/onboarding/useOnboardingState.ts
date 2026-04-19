import { useCallback, useState } from "react";

const STORAGE_KEY = "okcode:onboarding-completed:v1";

export function useOnboardingState() {
  const [open, setOpen] = useState(false);

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors
    }
    setOpen(false);
  }, []);

  return { open, complete, skip: complete };
}
