import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Path } from "effect";
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
import { ProviderHealthLive } from "./provider/Layers/ProviderHealth";
import { ProviderAdapterRegistryLive } from "./provider/Layers/ProviderAdapterRegistry";
import { makeProviderServiceLive } from "./provider/Layers/ProviderService";
import { ProviderSessionDirectoryLive } from "./provider/Layers/ProviderSessionDirectory";
import { ProviderRuntimeEventFeed } from "./provider/Services/ProviderRuntimeEventFeed";
import { ProviderService } from "./provider/Services/ProviderService";
import { makeEventNdjsonLogger } from "./provider/Layers/EventNdjsonLogger";
import { EnvironmentVariablesLive } from "./persistence/Services/EnvironmentVariables";
import { OpenclawGatewayConfigLive } from "./persistence/Layers/OpenclawGatewayConfig";

import { TerminalManagerLive } from "./terminal/Layers/Manager";
import { TerminalRuntimeEnvResolverLive } from "./terminal/Layers/RuntimeEnvResolver";
import { KeybindingsLive } from "./keybindings";
import { SkillServiceLive } from "./skills/SkillService";
import { GitManagerLive } from "./git/Layers/GitManager";
import { GitCoreLive } from "./git/Layers/GitCore";
import { GitHubCliLive } from "./git/Layers/GitHubCli";
import { CodexTextGenerationLive } from "./git/Layers/CodexTextGeneration";
import { RepoReviewConfigLive } from "./prReview/Layers/RepoReviewConfig";
import { PrReviewProjectionLive } from "./prReview/Layers/PrReviewProjection";
import { WorkflowEngineLive } from "./prReview/Layers/WorkflowEngine";
import { MergeConflictResolverLive } from "./prReview/Layers/MergeConflictResolver";
import { PrReviewLive } from "./prReview/Layers/PrReview";
import { GitHubLive } from "./github/Layers/GitHub";
import { PtyAdapter } from "./terminal/Services/PTY";
import { SmeKnowledgeDocumentRepositoryLive } from "./persistence/Layers/SmeKnowledgeDocuments";
import { SmeConversationRepositoryLive } from "./persistence/Layers/SmeConversations";
import { SmeMessageRepositoryLive } from "./persistence/Layers/SmeMessages";
import { SmeChatServiceLive } from "./sme/Layers/SmeChatServiceLive";

type RuntimePtyAdapterLoader = {
  layer: Layer.Layer<PtyAdapter, never, FileSystem.FileSystem | Path.Path>;
};

const runtimePtyAdapterLoaders = {
  bun: () => import("./terminal/Layers/BunPTY"),
  node: () => import("./terminal/Layers/NodePTY"),
} satisfies Record<string, () => Promise<RuntimePtyAdapterLoader>>;

const makeRuntimePtyAdapterLayer = () =>
  Effect.gen(function* () {
    const runtime = process.versions.bun !== undefined ? "bun" : "node";
    const loader = runtimePtyAdapterLoaders[runtime];
    const ptyAdapterModule = yield* Effect.promise<RuntimePtyAdapterLoader>(loader);
    return ptyAdapterModule.layer;
  }).pipe(Layer.unwrap);

export function makeServerProviderLayer(): Layer.Layer<
  ProviderService,
  ProviderUnsupportedError,
  | SqlClient.SqlClient
  | ServerConfig
  | FileSystem.FileSystem
  | ProviderRuntimeEventFeed
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

  const terminalLayer = TerminalManagerLive.pipe(Layer.provide(makeRuntimePtyAdapterLayer()));

  const gitManagerLayer = GitManagerLive.pipe(
    Layer.provideMerge(GitCoreLive),
    Layer.provideMerge(GitHubCliLive),
    Layer.provideMerge(textGenerationLayer),
  );

  const prReviewLayer = PrReviewLive.pipe(
    Layer.provideMerge(GitHubCliLive),
    Layer.provideMerge(RepoReviewConfigLive),
    Layer.provideMerge(PrReviewProjectionLive),
    Layer.provideMerge(WorkflowEngineLive),
    Layer.provideMerge(MergeConflictResolverLive.pipe(Layer.provideMerge(GitCoreLive))),
  );

  const githubLayer = GitHubLive.pipe(Layer.provideMerge(GitHubCliLive));

  const smeChatLayer = SmeChatServiceLive.pipe(
    Layer.provideMerge(EnvironmentVariablesLive),
    Layer.provideMerge(OpenclawGatewayConfigLive),
    Layer.provideMerge(ProviderHealthLive.pipe(Layer.provideMerge(OpenclawGatewayConfigLive))),
    Layer.provide(SmeKnowledgeDocumentRepositoryLive),
    Layer.provide(SmeConversationRepositoryLive),
    Layer.provide(SmeMessageRepositoryLive),
  );

  return Layer.mergeAll(
    orchestrationReactorLayer,
    GitCoreLive,
    gitManagerLayer,
    prReviewLayer,
    githubLayer,
    terminalLayer,
    TerminalRuntimeEnvResolverLive,
    KeybindingsLive,
    SkillServiceLive,
    OpenclawGatewayConfigLive,
    smeChatLayer,
  ).pipe(Layer.provideMerge(NodeServices.layer));
}
