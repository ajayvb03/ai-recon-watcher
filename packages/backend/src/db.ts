import type { SDK } from "caido:plugin";
import type { Database } from "sqlite";

/**
 * Gets the plugin's database with the schema ensured to exist.
 *
 * Not cached across calls: sdk.meta.db() and CREATE TABLE IF NOT EXISTS are
 * both cheap/idempotent, and NOT caching means a transient failure here
 * never permanently breaks capturing for the rest of the plugin's lifetime.
 */
export async function getInitializedDb(sdk: SDK): Promise<Database> {
  const db = await sdk.meta.db();
  await initSchema(db);
  return db;
}

export async function initSchema(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT,
      host TEXT,
      port INTEGER,
      method TEXT,
      path TEXT,
      query TEXT,
      status_code INTEGER,
      roundtrip_ms INTEGER,
      created_at TEXT,
      data TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS endpoints_seen (
      host TEXT,
      method TEXT,
      path TEXT,
      first_seen TEXT,
      last_seen TEXT,
      hit_count INTEGER,
      ai_related INTEGER,
      PRIMARY KEY (host, method, path)
    );
  `);
}

export async function insertCapture(
  db: Database,
  row: {
    requestId: string;
    host: string;
    port: number;
    method: string;
    path: string;
    query: string;
    statusCode: number;
    roundtripMs: number;
    createdAt: string;
    data: unknown;
  },
) {
  const stmt = await db.prepare(
    `INSERT INTO captures (request_id, host, port, method, path, query, status_code, roundtrip_ms, created_at, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await stmt.run(
    row.requestId,
    row.host,
    row.port,
    row.method,
    row.path,
    row.query,
    row.statusCode,
    row.roundtripMs,
    row.createdAt,
    JSON.stringify(row.data),
  );
}

export async function upsertEndpoint(
  db: Database,
  host: string,
  method: string,
  path: string,
  timestamp: string,
  aiRelated: boolean,
) {
  const stmt = await db.prepare(`
    INSERT INTO endpoints_seen (host, method, path, first_seen, last_seen, hit_count, ai_related)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(host, method, path) DO UPDATE SET
      last_seen = excluded.last_seen,
      hit_count = hit_count + 1,
      ai_related = MAX(ai_related, excluded.ai_related)
  `);
  await stmt.run(host, method, path, timestamp, timestamp, aiRelated ? 1 : 0);
}
