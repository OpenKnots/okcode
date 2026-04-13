import type { ModelSelection, ProviderKind, ProviderModelOptions } from "@okcode/contracts";
import {
  getModelSelectionModel,
  getModelSelectionOptions,
  getModelSelectionProvider,
  normalizeModelSelectionWithCapabilities,
  toCanonicalModelSelection,
} from "@okcode/shared/modelSelection";

import { getProviderDefaultModel, type ProviderModelOption } from "./providerModels";

export function resolveLiveModelSelection(input: {
  providerModelsByProvider: Record<ProviderKind, ReadonlyArray<ProviderModelOption>>;
  fallbackProvider: ProviderKind;
  preferredModelSelection?: ModelSelection | null | undefined;
  provider?: ProviderKind | null | undefined;
  model?: string | null | undefined;
  modelOptions?: ProviderModelOptions | null | undefined;
}): ModelSelection {
  const draftProvider = input.provider ?? input.fallbackProvider;
  const baseSelection =
    input.preferredModelSelection ??
    toCanonicalModelSelection(
      draftProvider,
      input.model ?? getProviderDefaultModel(draftProvider, input.providerModelsByProvider),
      input.modelOptions ?? undefined,
    );
  const provider = getModelSelectionProvider(baseSelection);
  const providerModels = input.providerModelsByProvider[provider];
  const resolvedModel = providerModels.some(
    (entry) => entry.slug === getModelSelectionModel(baseSelection),
  )
    ? getModelSelectionModel(baseSelection)
    : getProviderDefaultModel(provider, input.providerModelsByProvider);
  const capabilities =
    providerModels.find((entry) => entry.slug === resolvedModel)?.capabilities ?? null;

  return normalizeModelSelectionWithCapabilities(
    toCanonicalModelSelection(provider, resolvedModel, getModelSelectionOptions(baseSelection)),
    capabilities ? [{ slug: resolvedModel, capabilities }] : [],
  );
}
