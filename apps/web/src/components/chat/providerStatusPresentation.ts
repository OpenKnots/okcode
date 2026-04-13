import { type ServerProviderStatus } from "@okcode/contracts";
import { redactSensitiveText } from "@okcode/shared/redaction";

export type ProviderSetupPhase = "install" | "authenticate" | "verify" | "ready";

const PROVIDER_LABELS = {
  codex: "OpenAI (Codex CLI)",
  claudeAgent: "Claude Code",
  openclaw: "OpenClaw",
  copilot: "GitHub Copilot",
  gemini: "Gemini CLI",
} as const;

export function getProviderLabel(provider: ServerProviderStatus["provider"]): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function getProviderSetupPhase(status: ServerProviderStatus): ProviderSetupPhase {
  const authStatus = status.authStatus ?? status.auth?.status;
  if (!status.available) {
    return "install";
  }
  if (authStatus === "unauthenticated") {
    return "authenticate";
  }
  if (status.status === "ready") {
    return "ready";
  }
  return "verify";
}

export function getProviderStatusHeading(status: ServerProviderStatus): string {
  const label = getProviderLabel(status.provider);
  const phase = getProviderSetupPhase(status);

  switch (phase) {
    case "install":
      return `${label} is not installed`;
    case "authenticate":
      return `${label} needs authentication`;
    case "verify":
      return `${label} needs verification`;
    case "ready":
      return `${label} is ready`;
  }
}

export function getProviderStatusDescription(status: ServerProviderStatus): string {
  if (status.message) {
    return redactSensitiveText(status.message);
  }

  const label = getProviderLabel(status.provider);
  const phase = getProviderSetupPhase(status);

  switch (phase) {
    case "install":
      return `Install ${label} to use this provider.`;
    case "authenticate":
      return `Authenticate ${label} before starting or resuming turns.`;
    case "verify":
      return `Verify ${label} setup before continuing.`;
    case "ready":
      return `${label} is ready.`;
  }
}
