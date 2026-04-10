import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE sme_conversations
    ADD COLUMN provider TEXT NOT NULL DEFAULT 'claudeAgent'
  `.pipe(Effect.catch(() => Effect.void));

  yield* sql`
    ALTER TABLE sme_conversations
    ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'auto'
  `.pipe(Effect.catch(() => Effect.void));

  yield* sql`
    UPDATE sme_conversations
    SET provider = CASE
      WHEN lower(model) LIKE 'claude-%' THEN 'claudeAgent'
      WHEN lower(model) LIKE 'gpt-%' THEN 'codex'
      WHEN lower(model) LIKE 'openclaw/%' OR lower(model) = 'default' THEN 'openclaw'
      ELSE 'claudeAgent'
    END
    WHERE provider IS NULL
       OR provider = ''
       OR provider = 'claudeAgent'
  `;

  yield* sql`
    UPDATE sme_conversations
    SET auth_method = 'auto'
    WHERE auth_method IS NULL OR auth_method = ''
  `;
});
