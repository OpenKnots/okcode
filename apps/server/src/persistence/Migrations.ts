/**
 * MigrationsLive - Migration runner with inline loader
 *
 * Uses Migrator.make with fromRecord to define migrations inline.
 * All migrations are statically imported - no dynamic file system loading.
 *
 * Migrations run automatically when the MigrationLayer is provided,
 * ensuring the database schema is always up-to-date before the application starts.
 */

import * as Migrator from "effect/unstable/sql/Migrator";
import * as Layer from "effect/Layer";

// Import all migrations statically
import Migration0001 from "./Migrations/001_OrchestrationEvents.ts";
import Migration0002 from "./Migrations/002_OrchestrationCommandReceipts.ts";
import Migration0003 from "./Migrations/003_CheckpointDiffBlobs.ts";
import Migration0004 from "./Migrations/004_ProviderSessionRuntime.ts";
import Migration0005 from "./Migrations/005_Projections.ts";
import Migration0006 from "./Migrations/006_ProjectionThreadSessionRuntimeModeColumns.ts";
import Migration0007 from "./Migrations/007_ProjectionThreadMessageAttachments.ts";
import Migration0008 from "./Migrations/008_ProjectionThreadActivitySequence.ts";
import Migration0009 from "./Migrations/009_ProviderSessionRuntimeMode.ts";
import Migration0010 from "./Migrations/010_ProjectionThreadsRuntimeMode.ts";
import Migration0011 from "./Migrations/011_OrchestrationThreadCreatedRuntimeMode.ts";
import Migration0012 from "./Migrations/012_ProjectionThreadsInteractionMode.ts";
import Migration0013 from "./Migrations/013_ProjectionThreadProposedPlans.ts";
import Migration0014 from "./Migrations/014_ProjectionThreadProposedPlanImplementation.ts";
import Migration0015 from "./Migrations/015_ProjectionTurnsSourceProposedPlan.ts";
import Migration0016 from "./Migrations/016_ProjectionThreadsInteractionModeChatCodePlan.ts";
import Migration0017 from "./Migrations/017_EnvironmentVariables.ts";
import Migration0018 from "./Migrations/018_ProjectionThreadsGithubRef.ts";
import Migration0019 from "./Migrations/019_SmeKnowledgeBase.ts";
import Migration0020 from "./Migrations/020_SmeConversationProviderAuth.ts";
import Migration0021 from "./Migrations/021_ProjectionPendingUserInputs.ts";
import Migration0022 from "./Migrations/022_DecisionWorkspace.ts";
import Migration0023 from "./Migrations/023_ProjectionPendingUserInputsBackfill.ts";
import Migration0024 from "./Migrations/024_OpenclawGatewayConfig.ts";
import Migration0025 from "./Migrations/025_CanonicalizeModelSelections.ts";
import Migration0026 from "./Migrations/025_ProjectionProjectIconPath.ts";
import { Effect } from "effect";

/**
 * Migration loader with all migrations defined inline.
 *
 * Key format: "{id}_{name}" where:
 * - id: numeric migration ID (determines execution order)
 * - name: descriptive name for the migration
 *
 * Uses Migrator.fromRecord which parses the key format and
 * returns migrations sorted by ID.
 */
const loader = Migrator.fromRecord({
  "1_OrchestrationEvents": Migration0001,
  "2_OrchestrationCommandReceipts": Migration0002,
  "3_CheckpointDiffBlobs": Migration0003,
  "4_ProviderSessionRuntime": Migration0004,
  "5_Projections": Migration0005,
  "6_ProjectionThreadSessionRuntimeModeColumns": Migration0006,
  "7_ProjectionThreadMessageAttachments": Migration0007,
  "8_ProjectionThreadActivitySequence": Migration0008,
  "9_ProviderSessionRuntimeMode": Migration0009,
  "10_ProjectionThreadsRuntimeMode": Migration0010,
  "11_OrchestrationThreadCreatedRuntimeMode": Migration0011,
  "12_ProjectionThreadsInteractionMode": Migration0012,
  "13_ProjectionThreadProposedPlans": Migration0013,
  "14_ProjectionThreadProposedPlanImplementation": Migration0014,
  "15_ProjectionTurnsSourceProposedPlan": Migration0015,
  "16_ProjectionThreadsInteractionModeChatCodePlan": Migration0016,
  "17_EnvironmentVariables": Migration0017,
  "18_ProjectionThreadsGithubRef": Migration0018,
  "19_SmeKnowledgeBase": Migration0019,
  "20_SmeConversationProviderAuth": Migration0020,
  "21_ProjectionPendingUserInputs": Migration0021,
  "22_DecisionWorkspace": Migration0022,
  "23_ProjectionPendingUserInputsBackfill": Migration0023,
  "24_OpenclawGatewayConfig": Migration0024,
  "25_CanonicalizeModelSelections": Migration0025,
  "26_ProjectionProjectIconPath": Migration0026,
});

/**
 * Migrator run function - no schema dumping needed
 * Uses the base Migrator.make without platform dependencies
 */
const run = Migrator.make({});

/**
 * Run all pending migrations.
 *
 * Creates the migrations tracking table (effect_sql_migrations) if it doesn't exist,
 * then runs any migrations with ID greater than the latest recorded migration.
 *
 * Returns array of [id, name] tuples for migrations that were run.
 *
 * @returns Effect containing array of executed migrations
 */
export const runMigrations = Effect.gen(function* () {
  yield* Effect.log("Running migrations...");
  yield* run({ loader });
  yield* Effect.log("Migrations ran successfully");
});

/**
 * Layer that runs migrations when the layer is built.
 *
 * Use this to ensure migrations run before your application starts.
 * Migrations are run automatically - no separate script is needed.
 *
 * @example
 * ```typescript
 * import { MigrationsLive } from "@acme/db/Migrations"
 * import * as SqliteClient from "@acme/db/SqliteClient"
 *
 * // Migrations run automatically when SqliteClient is provided
 * const AppLayer = MigrationsLive.pipe(
 *   Layer.provideMerge(SqliteClient.layer({ filename: "database.sqlite" }))
 * )
 * ```
 */
export const MigrationsLive = Layer.effectDiscard(runMigrations);
