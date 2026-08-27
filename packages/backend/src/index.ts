import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

import { analyzeExchange } from "./analyze";
import { getEndpoints, getRecentCaptures, getSummary } from "./api";
import { getInitializedDb, insertCapture, upsertEndpoint } from "./db";

export * from "./api";

export type API = DefineAPI<{
  getSummary: typeof getSummary;
  getEndpoints: typeof getEndpoints;
  getRecentCaptures: typeof getRecentCaptures;
}>;

export function init(sdk: SDK<API>) {
  sdk.events.onInterceptResponse(async (_sdk, request: Request, response: Response) => {
    try {
      const db = await getInitializedDb(sdk);

      const responseBody = response.getBody();
      const responseBodyText = responseBody ? responseBody.toText() : "";

      const { data, aiRelated, findings } = analyzeExchange(request, response, responseBodyText);

      const createdAt = new Date().toISOString();

      await Promise.all([
        insertCapture(db, {
          requestId: String(request.getId()),
          host: request.getHost(),
          port: request.getPort(),
          method: request.getMethod(),
          path: request.getPath(),
          query: request.getQuery(),
          statusCode: response.getCode(),
          roundtripMs: response.getRoundtripTime(),
          createdAt,
          data,
        }),
        upsertEndpoint(
          db,
          request.getHost(),
          request.getMethod(),
          request.getPath(),
          createdAt,
          aiRelated,
        ),
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
    } catch (err) {
      const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
      sdk.console.log(`[ai-recon-watcher] error analyzing exchange: ${detail}`);
    }
  });

  sdk.api.register("getSummary", getSummary);
  sdk.api.register("getEndpoints", getEndpoints);
  sdk.api.register("getRecentCaptures", getRecentCaptures);

  sdk.console.log("[ai-recon-watcher] initialized - passively watching traffic");
}
