import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Add github_ref column (JSON blob) to projection_threads.
  yield* sql`
    ALTER TABLE projection_threads ADD COLUMN github_ref TEXT DEFAULT NULL
  `.pipe(Effect.ignore);
});
