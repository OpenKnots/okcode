import type { ModelSelection, ProviderKind, ProviderModelOptions } from "@okcode/contracts";
import { toCanonicalModelSelection } from "@okcode/shared/modelSelection";
import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

type ProjectRow = {
  readonly projectId: string;
  readonly defaultModel: string | null;
  readonly defaultModelSelection: string | null;
};

type ThreadRow = {
  readonly threadId: string;
  readonly model: string | null;
  readonly modelSelection: string | null;
};

function inferProviderKind(model: string): ProviderKind {
  if (model.startsWith("claude-")) return "claudeAgent";
  if (model.startsWith("openclaw/")) return "openclaw";
  if (model.startsWith("copilot/")) return "copilot";
  if (model.startsWith("gemini-") || model.startsWith("auto-gemini-")) return "gemini";
  return "codex";
}

function parseStoredSelection(raw: string | null | undefined): ModelSelection | string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") {
      return parseStoredSelection(parsed);
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "provider" in parsed &&
      typeof parsed.provider === "string" &&
      "model" in parsed &&
      typeof parsed.model === "string"
    ) {
      return parsed as ModelSelection;
    }
  } catch {
    // Fall through and treat legacy plain strings as model slugs.
  }

  return trimmed;
}

function toCanonicalSelectionJson(
  rawSelection: string | null | undefined,
  fallbackModel: string | null | undefined,
): string | null {
  const parsed = parseStoredSelection(rawSelection);

  if (parsed && typeof parsed === "object") {
    const providerOptions = parsed.options
      ? ({ [parsed.provider]: parsed.options } as ProviderModelOptions)
      : undefined;
    return JSON.stringify(
      toCanonicalModelSelection(parsed.provider, parsed.model, providerOptions),
    );
  }

  const model =
    typeof parsed === "string" && parsed.length > 0
      ? parsed
      : typeof fallbackModel === "string" && fallbackModel.trim().length > 0
        ? fallbackModel.trim()
        : null;

  if (!model) return null;
  return JSON.stringify(toCanonicalModelSelection(inferProviderKind(model), model, undefined));
}

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE projection_projects
    ADD COLUMN default_model_selection TEXT
  `.pipe(Effect.catchCause(() => Effect.void));

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN model_selection TEXT
  `.pipe(Effect.catchCause(() => Effect.void));

  const projectRows = yield* sql<ProjectRow>`
    SELECT
      project_id AS projectId,
      default_model AS defaultModel,
      default_model_selection AS defaultModelSelection
    FROM projection_projects
  `;

  for (const row of projectRows) {
    const nextSelection = toCanonicalSelectionJson(row.defaultModelSelection, row.defaultModel);
    yield* sql`
      UPDATE projection_projects
      SET default_model_selection = ${nextSelection}
      WHERE project_id = ${row.projectId}
    `;
  }

  const threadRows = yield* sql<ThreadRow>`
    SELECT
      thread_id AS threadId,
      model,
      model_selection AS modelSelection
    FROM projection_threads
  `;

  for (const row of threadRows) {
    const nextSelection = toCanonicalSelectionJson(row.modelSelection, row.model);
    yield* sql`
      UPDATE projection_threads
      SET model_selection = ${nextSelection}
      WHERE thread_id = ${row.threadId}
    `;
  }
});
