import { useCallback, useState } from "react";

const STORAGE_KEY = "okcode:onboarding-completed:v1";

export function useOnboardingState() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return localStorage.getItem(STORAGE_KEY) !== "true";
    } catch {
      return false;
    }
  });

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
