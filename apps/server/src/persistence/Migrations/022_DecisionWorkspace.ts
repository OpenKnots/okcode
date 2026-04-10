import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS decision_cases (
      case_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      cwd TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      conflict_kind TEXT NOT NULL,
      linked_thread_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_decision_cases_cwd
    ON decision_cases(cwd, updated_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS decision_consultations (
      consultation_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      response_summary TEXT,
      linked_thread_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_decision_consultations_case
    ON decision_consultations(case_id, created_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS decision_score_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      analysis_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_decision_score_snapshots_case
    ON decision_score_snapshots(case_id, created_at)
  `;
});
