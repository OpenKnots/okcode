import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

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

  yield* sql`
    UPDATE projection_projects
    SET default_model_selection = CASE
      WHEN default_model IS NULL OR TRIM(default_model) = '' THEN NULL
      WHEN default_model LIKE 'claude-%' THEN json_object('provider', 'claudeAgent', 'model', default_model)
      WHEN default_model LIKE 'openclaw/%' THEN json_object('provider', 'openclaw', 'model', default_model)
      WHEN default_model LIKE 'copilot/%' THEN json_object('provider', 'copilot', 'model', default_model)
      WHEN default_model LIKE 'gemini-%' OR default_model LIKE 'auto-gemini-%' THEN json_object('provider', 'gemini', 'model', default_model)
      ELSE json_object('provider', 'codex', 'model', default_model)
    END
    WHERE default_model_selection IS NULL
  `;

  yield* sql`
    UPDATE projection_threads
    SET model_selection = CASE
      WHEN model IS NULL OR TRIM(model) = '' THEN NULL
      WHEN model LIKE 'claude-%' THEN json_object('provider', 'claudeAgent', 'model', model)
      WHEN model LIKE 'openclaw/%' THEN json_object('provider', 'openclaw', 'model', model)
      WHEN model LIKE 'copilot/%' THEN json_object('provider', 'copilot', 'model', model)
      WHEN model LIKE 'gemini-%' OR model LIKE 'auto-gemini-%' THEN json_object('provider', 'gemini', 'model', model)
      ELSE json_object('provider', 'codex', 'model', model)
    END
    WHERE model_selection IS NULL
  `;
});
