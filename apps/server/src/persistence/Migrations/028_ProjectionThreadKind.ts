import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'thread'
  `.pipe(Effect.ignore);

  yield* sql`
    UPDATE projection_threads
    SET kind = 'thread'
    WHERE kind IS NULL OR TRIM(kind) = ''
  `;
});
