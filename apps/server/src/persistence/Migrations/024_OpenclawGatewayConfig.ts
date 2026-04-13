import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS openclaw_gateway_config (
      config_id TEXT PRIMARY KEY,
      gateway_url TEXT NOT NULL,
      encrypted_shared_secret TEXT NULL,
      device_id TEXT NOT NULL,
      device_public_key TEXT NOT NULL,
      device_fingerprint TEXT NOT NULL,
      encrypted_device_private_key TEXT NOT NULL,
      encrypted_device_token TEXT NULL,
      device_token_role TEXT NULL,
      device_token_scopes_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
});
