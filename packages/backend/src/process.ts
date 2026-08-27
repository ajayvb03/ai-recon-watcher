import type { SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

import { analyzeExchange } from "./analyze";
import { getInitializedDb, insertCapture, upsertEndpoint, upsertSkill } from "./db";

/**
 * Shared analyze-store-report path used by both the live traffic watcher
 * and the "send to recon now" command - one code path, so a manually
 * triggered analysis behaves identically to the passive one.
 */
export async function processExchange(
  sdk: SDK,
  request: Request,
  response: Response,
): Promise<void> {
  const db = await getInitializedDb(sdk);

  const responseBody = response.getBody();
  const responseBodyText = responseBody ? responseBody.toText() : "";

  const { data, aiRelated, findings, toolCalls } = analyzeExchange(
    request,
    response,
    responseBodyText,
  );

  const createdAt = new Date().toISOString();
  const host = request.getHost();

  await Promise.all([
    insertCapture(db, {
      requestId: String(request.getId()),
      host,
      port: request.getPort(),
      method: request.getMethod(),
      path: request.getPath(),
      query: request.getQuery(),
      statusCode: response.getCode(),
      roundtripMs: response.getRoundtripTime(),
      createdAt,
      data,
    }),
    upsertEndpoint(db, host, request.getMethod(), request.getPath(), createdAt, aiRelated),
    ...toolCalls.map((call) => upsertSkill(db, host, call.name, createdAt, call.argsSummary)),
  ]);

  for (const finding of findings) {
    await sdk.findings.create({
      title: finding.title,
      description: finding.description,
      reporter: "AI Recon Watcher",
      dedupeKey: finding.dedupeKey,
      request,
    });
  }
}
