import type { ProviderKind, ServerProviderStatus } from "@okcode/contracts";

const THREAD_PROVIDER_ORDER: readonly ProviderKind[] = ["codex", "claudeAgent", "openclaw"];

const THREAD_PROVIDER_LABELS: Record<ProviderKind, string> = {
  codex: "Codex",
  claudeAgent: "Claude Code",
  openclaw: "OpenClaw",
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
  openclawGatewayUrl?: string | null | undefined;
}): boolean {
  const status = getProviderStatusByKind(input.statuses, input.provider);

  if (input.provider === "openclaw") {
    if (status?.status === "ready" && status.available) {
      return true;
    }
    return (input.openclawGatewayUrl ?? "").trim().length > 0;
  }

  if (!status) {
    return false;
  }

  return status.available && status.status === "ready" && status.authStatus !== "unauthenticated";
}

export function getSelectableThreadProviders(input: {
  statuses: ReadonlyArray<ServerProviderStatus>;
  openclawGatewayUrl?: string | null | undefined;
}): ProviderKind[] {
  return THREAD_PROVIDER_ORDER.filter((provider) =>
    isProviderReadyForThreadSelection({
      provider,
      statuses: input.statuses,
      openclawGatewayUrl: input.openclawGatewayUrl,
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
