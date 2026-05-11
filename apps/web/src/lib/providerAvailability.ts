import type { ProviderKind, ServerProviderStatus } from "@okcode/contracts";

const THREAD_PROVIDER_ORDER: readonly ProviderKind[] = [
  "codex",
  "claudeAgent",
  "gemini",
  "copilot",
];

const THREAD_PROVIDER_LABELS: Record<ProviderKind, string> = {
  codex: "Codex",
  claudeAgent: "Claude Code",
  gemini: "Gemini",
  copilot: "GitHub Copilot",
};

export function getThreadProviderLabel(provider: ProviderKind): string {
  return THREAD_PROVIDER_LABELS[provider];
}

export function getProviderStatusByKind(
  statuses: ReadonlyArray<ServerProviderStatus>,
  provider: ProviderKind,
): ServerProviderStatus | null {
  return statuses.find((status) => status.provider === provider) ?? null;
}

export function isProviderReadyForThreadSelection(input: {
  provider: ProviderKind;
  statuses: ReadonlyArray<ServerProviderStatus>;
}): boolean {
  const status = getProviderStatusByKind(input.statuses, input.provider);

  if (!status) {
    return false;
  }

  const authStatus = status.authStatus ?? status.auth?.status;
  return Boolean(status.available && status.status === "ready" && authStatus !== "unauthenticated");
}

export function getSelectableThreadProviders(input: {
  statuses: ReadonlyArray<ServerProviderStatus>;
}): ProviderKind[] {
  return THREAD_PROVIDER_ORDER.filter((provider) =>
    isProviderReadyForThreadSelection({
      provider,
      statuses: input.statuses,
    }),
  );
}

export function resolveThreadProviderSelection(input: {
  preferredProvider?: ProviderKind | null | undefined;
  selectableProviders: ReadonlyArray<ProviderKind>;
}): ProviderKind {
  if (input.preferredProvider && input.selectableProviders.includes(input.preferredProvider)) {
    return input.preferredProvider;
  }

  return input.selectableProviders[0] ?? input.preferredProvider ?? "codex";
}
