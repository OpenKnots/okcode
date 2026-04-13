import type { ModelCapabilities, ProviderKind, ServerProviderStatus } from "@okcode/contracts";
import { getDefaultModel } from "@okcode/shared/model";

import { normalizeCustomModelSlugs, type AppModelOption } from "./appSettings";

export type ProviderModelOption = AppModelOption & {
  capabilities?: ModelCapabilities | null | undefined;
};

const PROVIDER_KINDS: readonly ProviderKind[] = [
  "codex",
  "claudeAgent",
  "copilot",
  "openclaw",
  "gemini",
];

export function getProviderSnapshot(
  providers: ReadonlyArray<ServerProviderStatus>,
  provider: ProviderKind,
): ServerProviderStatus | null {
  return providers.find((entry) => entry.provider === provider) ?? null;
}

export function getProviderModelOptionsByProvider(input: {
  providers: ReadonlyArray<ServerProviderStatus>;
  customModelsByProvider: Record<ProviderKind, readonly string[]>;
}): Record<ProviderKind, ReadonlyArray<ProviderModelOption>> {
  return PROVIDER_KINDS.reduce(
    (acc, provider) => {
      const snapshotModels = getProviderSnapshot(input.providers, provider)?.models ?? [];
      const options: ProviderModelOption[] = snapshotModels.map((model) => ({
        slug: model.slug,
        name: model.name,
        isCustom: model.isCustom,
        capabilities: model.capabilities,
      }));
      const seen = new Set(options.map((model) => model.slug));

      for (const slug of normalizeCustomModelSlugs(
        input.customModelsByProvider[provider],
        provider,
      )) {
        if (seen.has(slug)) {
          continue;
        }
        seen.add(slug);
        options.push({
          slug,
          name: slug,
          isCustom: true,
          capabilities: null,
        });
      }

      acc[provider] = options;
      return acc;
    },
    {} as Record<ProviderKind, ReadonlyArray<ProviderModelOption>>,
  );
}

export function getProviderDefaultModel(
  provider: ProviderKind,
  providerModelsByProvider: Record<ProviderKind, ReadonlyArray<ProviderModelOption>>,
): string {
  return providerModelsByProvider[provider][0]?.slug ?? getDefaultModel(provider);
}
