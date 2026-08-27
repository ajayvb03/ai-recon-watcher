import type { SDK } from "caido:plugin";
import type { Database } from "sqlite";

/**
 * Shared, memoized handle to the plugin's database.
 *
 * This MUST be cached and shared across every call site (the traffic
 * interceptor and all three dashboard RPC methods). Without sharing, each
 * concurrent call (e.g. the dashboard's Promise.all of three RPC calls)
 * independently opens its own connection and races to run
 * CREATE TABLE IF NOT EXISTS against the same file at the same time,
 * which throws SQLITE_BUSY ("database is locked").
 *
 * On failure the cache is cleared so a transient error doesn't permanently
 * disable capturing for the rest of the plugin's lifetime - the next call
 * gets a fresh attempt instead of reusing a rejected promise forever.
 */
let dbPromise: Promise<Database> | undefined;

export async function getInitializedDb(sdk: SDK): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await sdk.meta.db();
      await initSchema(db);
      return db;
    })().catch((err: unknown) => {
      dbPromise = undefined;
      throw err;
    });
  }
  return dbPromise;
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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS target_domains (
      host TEXT PRIMARY KEY,
      added_at TEXT
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
