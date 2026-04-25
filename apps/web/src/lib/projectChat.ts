import type { ModelSelection, ProjectId, ProviderKind } from "@okcode/contracts";
import { getDefaultModel, inferProviderForModel } from "@okcode/shared/model";
import { getModelSelectionProvider } from "@okcode/shared/modelSelection";

import type { Thread } from "../types";
import { resolveThreadProviderSelection } from "./providerAvailability";

export function findProjectChatThread(
  threads: readonly Thread[],
  projectId: ProjectId,
): Thread | null {
  return (
    threads.find((thread) => thread.projectId === projectId && thread.kind === "project-chat") ??
    null
  );
}

function buildDefaultModelSelection(provider: ProviderKind): ModelSelection {
  switch (provider) {
    case "codex":
      return { provider, model: getDefaultModel(provider) };
    case "claudeAgent":
      return { provider, model: getDefaultModel(provider) };
    case "copilot":
      return { provider, model: getDefaultModel(provider) };
    case "gemini":
      return { provider, model: getDefaultModel(provider) };
    case "openclaw":
      return { provider, model: getDefaultModel(provider) };
  }
}

export function resolveProjectChatModelSelection(input: {
  projectDefaultModelSelection?: ModelSelection | null | undefined;
  projectModel: string;
  selectableProviders: ReadonlyArray<ProviderKind>;
}): ModelSelection {
  const projectDefaultProvider = input.projectDefaultModelSelection
    ? getModelSelectionProvider(input.projectDefaultModelSelection)
    : inferProviderForModel(input.projectModel);
  const preferredProvider = input.selectableProviders.includes("codex")
    ? "codex"
    : projectDefaultProvider;
  const provider = resolveThreadProviderSelection({
    preferredProvider,
    selectableProviders: input.selectableProviders,
  });

  if (
    input.projectDefaultModelSelection &&
    getModelSelectionProvider(input.projectDefaultModelSelection) === provider
  ) {
    return input.projectDefaultModelSelection;
  }

  return buildDefaultModelSelection(provider);
}
