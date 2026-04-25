import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { CheckpointDiffQueryLive } from "./checkpointing/Layers/CheckpointDiffQuery";
import { CheckpointStoreLive } from "./checkpointing/Layers/CheckpointStore";
import { ServerConfig } from "./config";
import { OrchestrationCommandReceiptRepositoryLive } from "./persistence/Layers/OrchestrationCommandReceipts";
import { OrchestrationEventStoreLive } from "./persistence/Layers/OrchestrationEventStore";
import { ProviderSessionRuntimeRepositoryLive } from "./persistence/Layers/ProviderSessionRuntime";
import { OrchestrationEngineLive } from "./orchestration/Layers/OrchestrationEngine";
import { CheckpointReactorLive } from "./orchestration/Layers/CheckpointReactor";
import { OrchestrationReactorLive } from "./orchestration/Layers/OrchestrationReactor";
import { ProviderCommandReactorLive } from "./orchestration/Layers/ProviderCommandReactor";
import { OrchestrationProjectionPipelineLive } from "./orchestration/Layers/ProjectionPipeline";
import { OrchestrationProjectionSnapshotQueryLive } from "./orchestration/Layers/ProjectionSnapshotQuery";
import { OrchestrationProjectionOverviewQueryLive } from "./orchestration/Layers/ProjectionOverviewQuery";
import { OrchestrationProjectionThreadDetailQueryLive } from "./orchestration/Layers/ProjectionThreadDetailQuery";
import { ProviderRuntimeIngestionLive } from "./orchestration/Layers/ProviderRuntimeIngestion";
import { RuntimeReceiptBusLive } from "./orchestration/Layers/RuntimeReceiptBus";
import { ProviderUnsupportedError } from "./provider/Errors";
import { makeClaudeAdapterLive } from "./provider/Layers/ClaudeAdapter";
import { makeCopilotAdapterLive } from "./provider/Layers/CopilotAdapter";
import { makeCodexAdapterLive } from "./provider/Layers/CodexAdapter";
import { GeminiAdapterLive } from "./provider/Layers/GeminiAdapter";
import { makeOpenClawAdapterLive } from "./provider/Layers/OpenClawAdapter";
import { ProviderAdapterRegistryLive } from "./provider/Layers/ProviderAdapterRegistry";
import { makeProviderServiceLive } from "./provider/Layers/ProviderService";
import { ProviderSessionDirectoryLive } from "./provider/Layers/ProviderSessionDirectory";
import { ProviderRuntimeEventFeed } from "./provider/Services/ProviderRuntimeEventFeed";
import { ProviderService } from "./provider/Services/ProviderService";
import { makeEventNdjsonLogger } from "./provider/Layers/EventNdjsonLogger";
import { EnvironmentVariablesLive } from "./persistence/Services/EnvironmentVariables";
import { KeybindingsLive } from "./keybindings";
import { OpenclawGatewayConfigLive } from "./persistence/Layers/OpenclawGatewayConfig";
import { GitCoreLive } from "./git/Layers/GitCore";
import { CodexTextGenerationLive } from "./git/Layers/CodexTextGeneration";
import { GitManagerLive } from "./git/Layers/GitManager";
import { GitHubCliLive } from "./git/Layers/GitHubCli";
import { GitHubLive } from "./github/Layers/GitHub";
import { RepoReviewConfigLive } from "./prReview/Layers/RepoReviewConfig";
import { PrReviewProjectionLive } from "./prReview/Layers/PrReviewProjection";
import { WorkflowEngineLive } from "./prReview/Layers/WorkflowEngine";
import { MergeConflictResolverLive } from "./prReview/Layers/MergeConflictResolver";
import { PrReviewLive } from "./prReview/Layers/PrReview";
import { SkillServiceLive } from "./skills/SkillService";
import { TerminalManagerLive } from "./terminal/Layers/Manager";
import { TerminalRuntimeEnvResolverLive } from "./terminal/Layers/RuntimeEnvResolver";
import { makeRuntimePtyAdapterLayer } from "./terminal/Layers/runtimePtyAdapter";

export function makeServerProviderLayer(): Layer.Layer<
  ProviderService,
  ProviderUnsupportedError,
  | SqlClient.SqlClient
  | ServerConfig
  | ProviderRuntimeEventFeed
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    const { providerEventLogPath } = yield* ServerConfig;
    const nativeEventLogger = yield* makeEventNdjsonLogger(providerEventLogPath, {
      stream: "native",
    });
    const canonicalEventLogger = yield* makeEventNdjsonLogger(providerEventLogPath, {
      stream: "canonical",
    });
    const providerSessionDirectoryLayer = ProviderSessionDirectoryLive.pipe(
      Layer.provide(ProviderSessionRuntimeRepositoryLive),
    );
    const codexAdapterLayer = makeCodexAdapterLive(
      nativeEventLogger ? { nativeEventLogger } : undefined,
    ).pipe(
      Layer.provideMerge(EnvironmentVariablesLive),
      Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
      Layer.provideMerge(OrchestrationProjectionOverviewQueryLive),
      Layer.provideMerge(OrchestrationProjectionThreadDetailQueryLive),
    );
    const claudeAdapterLayer = makeClaudeAdapterLive(
      nativeEventLogger ? { nativeEventLogger } : undefined,
    ).pipe(
      Layer.provideMerge(EnvironmentVariablesLive),
      Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
      Layer.provideMerge(OrchestrationProjectionOverviewQueryLive),
      Layer.provideMerge(OrchestrationProjectionThreadDetailQueryLive),
    );
    const openclawAdapterLayer = makeOpenClawAdapterLive(
      nativeEventLogger ? { nativeEventLogger } : undefined,
    ).pipe(Layer.provideMerge(OpenclawGatewayConfigLive));
    const copilotAdapterLayer = makeCopilotAdapterLive(
      nativeEventLogger ? { nativeEventLogger } : undefined,
    );
    const geminiAdapterLayer = GeminiAdapterLive;
    const adapterRegistryLayer = ProviderAdapterRegistryLive.pipe(
      Layer.provide(codexAdapterLayer),
      Layer.provide(claudeAdapterLayer),
      Layer.provide(openclawAdapterLayer),
      Layer.provide(copilotAdapterLayer),
      Layer.provide(geminiAdapterLayer),
      Layer.provideMerge(providerSessionDirectoryLayer),
    );
    return makeProviderServiceLive(
      canonicalEventLogger ? { canonicalEventLogger } : undefined,
    ).pipe(Layer.provide(adapterRegistryLayer), Layer.provide(providerSessionDirectoryLayer));
  }).pipe(Layer.unwrap);
}

export function makeOptionalGitManagerLayer() {
  const textGenerationLayer = CodexTextGenerationLive;
  return GitManagerLive.pipe(
    Layer.provideMerge(GitCoreLive),
    Layer.provideMerge(GitHubCliLive),
    Layer.provideMerge(textGenerationLayer),
  );
}

export function makeOptionalGitHubLayer() {
  return GitHubLive.pipe(Layer.provideMerge(GitHubCliLive));
}

export function makeOptionalPrReviewLayer() {
  return PrReviewLive.pipe(
    Layer.provideMerge(GitHubCliLive),
    Layer.provideMerge(RepoReviewConfigLive),
    Layer.provideMerge(PrReviewProjectionLive),
    Layer.provideMerge(WorkflowEngineLive),
    Layer.provideMerge(MergeConflictResolverLive.pipe(Layer.provideMerge(GitCoreLive))),
  );
}

export function makeOptionalSkillServiceLayer() {
  return SkillServiceLive;
}

export function makeOptionalTerminalManagerLayer() {
  return TerminalManagerLive.pipe(Layer.provide(makeRuntimePtyAdapterLayer()));
}

export function makeOptionalTerminalRuntimeEnvResolverLayer() {
  return TerminalRuntimeEnvResolverLive;
}

export function makeServerRuntimeServicesLayer() {
  const textGenerationLayer = CodexTextGenerationLive;
  const checkpointStoreLayer = CheckpointStoreLive.pipe(Layer.provide(GitCoreLive));

  const orchestrationLayer = OrchestrationEngineLive.pipe(
    Layer.provide(OrchestrationProjectionPipelineLive),
    Layer.provide(OrchestrationEventStoreLive),
    Layer.provide(OrchestrationCommandReceiptRepositoryLive),
  );

  const checkpointDiffQueryLayer = CheckpointDiffQueryLive.pipe(
    Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
    Layer.provideMerge(checkpointStoreLayer),
  );

  const runtimeServicesLayer = Layer.empty.pipe(
    Layer.provideMerge(EnvironmentVariablesLive),
    Layer.provideMerge(OpenclawGatewayConfigLive),
    Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
    Layer.provideMerge(OrchestrationProjectionOverviewQueryLive),
    Layer.provideMerge(OrchestrationProjectionThreadDetailQueryLive),
    Layer.provideMerge(orchestrationLayer),
    Layer.provideMerge(checkpointStoreLayer),
    Layer.provideMerge(checkpointDiffQueryLayer),
    Layer.provideMerge(RuntimeReceiptBusLive),
  );
  const runtimeIngestionLayer = ProviderRuntimeIngestionLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );
  const providerCommandReactorLayer = ProviderCommandReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
    Layer.provideMerge(GitCoreLive),
    Layer.provideMerge(textGenerationLayer),
  );
  const checkpointReactorLayer = CheckpointReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );
  const orchestrationReactorLayer = OrchestrationReactorLive.pipe(
    Layer.provideMerge(runtimeIngestionLayer),
    Layer.provideMerge(providerCommandReactorLayer),
    Layer.provideMerge(checkpointReactorLayer),
  );

  return Layer.mergeAll(
    orchestrationReactorLayer,
    GitCoreLive,
    KeybindingsLive,
    OpenclawGatewayConfigLive,
  ).pipe(Layer.provideMerge(NodeServices.layer));
}
