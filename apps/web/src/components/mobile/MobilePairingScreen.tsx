import { useState } from "react";

import { APP_DISPLAY_NAME } from "../../branding";
import { readMobileBridge } from "../../lib/runtimeBridge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function MobilePairingScreen() {
  const mobileBridge = readMobileBridge();
  const [pairingInput, setPairingInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleSubmit = async () => {
    if (!mobileBridge) {
      setErrorMessage("Mobile pairing bridge is unavailable.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const nextState = await mobileBridge.applyPairingUrl(pairingInput);
      if (!nextState.paired) {
        setErrorMessage(nextState.lastError ?? "Could not pair this device.");
        return;
      }
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not pair this device.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!mobileBridge) {
      return;
    }
    setIsClearing(true);
    setErrorMessage(null);
    try {
      await mobileBridge.clearPairing();
      setPairingInput("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not clear pairing.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(44rem_16rem_at_top,color-mix(in_srgb,var(--color-emerald-500)_12%,transparent),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--background)_92%,var(--color-black))_0%,var(--background)_55%)]" />
      </div>

      <section className="relative w-full max-w-md rounded-2xl border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {APP_DISPLAY_NAME}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Pair this device</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Paste a pairing link like <code>okcode://pair?server=…&amp;token=…</code> or a server URL
          that includes <code>?token=…</code>.
        </p>

        <div className="mt-5 space-y-3">
          <Input
            value={pairingInput}
            onChange={(event) => setPairingInput(event.target.value)}
            placeholder="okcode://pair?server=…&token=…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
          />
          {errorMessage ? <p className="text-xs text-red-500">{errorMessage}</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Pairing..." : "Pair device"}
          </Button>
          <Button variant="outline" onClick={() => void handleReset()} disabled={isClearing}>
            Clear saved pairing
          </Button>
        </div>
      </section>
    </div>
  );
}
