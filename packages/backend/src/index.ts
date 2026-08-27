import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

import { analyzeExchange } from "./analyze";
import {
  addTargetDomain,
  clearCapturedData,
  getEndpoints,
  getRecentCaptures,
  getSummary,
  getTargetDomains,
  removeTargetDomain,
} from "./api";
import { getInitializedDb, insertCapture, upsertEndpoint } from "./db";

export * from "./api";

export type API = DefineAPI<{
  getSummary: typeof getSummary;
  getEndpoints: typeof getEndpoints;
  getRecentCaptures: typeof getRecentCaptures;
  getTargetDomains: typeof getTargetDomains;
  addTargetDomain: typeof addTargetDomain;
  removeTargetDomain: typeof removeTargetDomain;
  clearCapturedData: typeof clearCapturedData;
}>;

export function init(sdk: SDK<API>) {
  sdk.events.onInterceptResponse(async (_sdk, request: Request, response: Response) => {
    try {
      // Scope gate: only watch traffic to hosts the operator has explicitly
      // added as a target. With no targets configured, nothing is captured -
      // this plugin must never passively log traffic outside the declared
      // engagement scope just because it happens to pass through Caido.
      const targetDomains = await getTargetDomains(sdk);
      const scopedHosts = new Set(targetDomains.map((d) => d.host));
      if (scopedHosts.size === 0 || !scopedHosts.has(request.getHost())) {
        return;
      }

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
  sdk.api.register("getTargetDomains", getTargetDomains);
  sdk.api.register("addTargetDomain", addTargetDomain);
  sdk.api.register("removeTargetDomain", removeTargetDomain);
  sdk.api.register("clearCapturedData", clearCapturedData);

  sdk.console.log("[ai-recon-watcher] initialized - passively watching traffic (scoped to configured target domains)");
}
