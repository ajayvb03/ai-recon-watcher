import type { SDK } from "caido:plugin";

import { getInitializedDb } from "./db";

export async function getSummary(sdk: SDK) {
  const db = await getInitializedDb(sdk);

  const totalCapturesStmt = await db.prepare("SELECT COUNT(*) as c FROM captures");
  const totalEndpointsStmt = await db.prepare("SELECT COUNT(*) as c FROM endpoints_seen");
  const aiEndpointsStmt = await db.prepare(
    "SELECT COUNT(*) as c FROM endpoints_seen WHERE ai_related = 1",
  );

  const totalCaptures = await totalCapturesStmt.get<{ c: number }>();
  const totalEndpoints = await totalEndpointsStmt.get<{ c: number }>();
  const aiEndpoints = await aiEndpointsStmt.get<{ c: number }>();

  return {
    totalCaptures: totalCaptures?.c ?? 0,
    totalEndpoints: totalEndpoints?.c ?? 0,
    aiRelatedEndpoints: aiEndpoints?.c ?? 0,
  };
}

export type EndpointRow = {
  host: string;
  method: string;
  path: string;
  hit_count: number;
  ai_related: number;
  first_seen: string;
  last_seen: string;
};

export async function getEndpoints(sdk: SDK): Promise<EndpointRow[]> {
  const db = await getInitializedDb(sdk);
  const stmt = await db.prepare(
    `SELECT host, method, path, hit_count, ai_related, first_seen, last_seen
     FROM endpoints_seen ORDER BY last_seen DESC LIMIT 200`,
  );
  return stmt.all<EndpointRow>();
}

export type CaptureRow = {
  id: number;
  request_id: string;
  host: string;
  method: string;
  path: string;
  status_code: number;
  roundtrip_ms: number;
  created_at: string;
  data: string;
};

const MAX_RECENT_CAPTURES_LIMIT = 200;

export async function getRecentCaptures(sdk: SDK, limit: number = 50): Promise<CaptureRow[]> {
  const db = await getInitializedDb(sdk);
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), MAX_RECENT_CAPTURES_LIMIT);
  const stmt = await db.prepare(
    `SELECT id, request_id, host, method, path, status_code, roundtrip_ms, created_at, data
     FROM captures ORDER BY id DESC LIMIT ?`,
  );
  return stmt.all<CaptureRow>(safeLimit);
}

export type TargetDomain = {
  host: string;
  added_at: string;
};

/**
 * Accepts either a bare hostname ("example.com") or a full URL
 * ("https://example.com/chat?x=1") and extracts just the hostname.
 * No dependency on a runtime URL implementation being available.
 */
function parseHost(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const withoutScheme = trimmed.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  const host = withoutScheme.split(/[/?#:]/)[0]?.toLowerCase();
  return host || undefined;
}

export async function getTargetDomains(sdk: SDK): Promise<TargetDomain[]> {
  const db = await getInitializedDb(sdk);
  const stmt = await db.prepare("SELECT host, added_at FROM target_domains ORDER BY added_at ASC");
  return stmt.all<TargetDomain>();
}

export async function addTargetDomain(sdk: SDK, input: string): Promise<TargetDomain[]> {
  const host = parseHost(input);
  if (!host) {
    throw new Error(`Could not parse a hostname from "${input}"`);
  }
  const db = await getInitializedDb(sdk);
  const stmt = await db.prepare(
    "INSERT INTO target_domains (host, added_at) VALUES (?, ?) ON CONFLICT(host) DO NOTHING",
  );
  await stmt.run(host, new Date().toISOString());
  return getTargetDomains(sdk);
}

export async function removeTargetDomain(sdk: SDK, host: string): Promise<TargetDomain[]> {
  const db = await getInitializedDb(sdk);
  const stmt = await db.prepare("DELETE FROM target_domains WHERE host = ?");
  await stmt.run(host);
  return getTargetDomains(sdk);
}
