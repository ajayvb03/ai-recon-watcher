import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

import {
  analyzeRequestById,
  clearCapturedData,
  getEndpoints,
  getRecentCaptures,
  getSkills,
  getSummary,
} from "./api";
import { processExchange } from "./process";

export * from "./api";

export type API = DefineAPI<{
  getSummary: typeof getSummary;
  getEndpoints: typeof getEndpoints;
  getRecentCaptures: typeof getRecentCaptures;
  getSkills: typeof getSkills;
  clearCapturedData: typeof clearCapturedData;
  analyzeRequestById: typeof analyzeRequestById;
}>;

export function init(sdk: SDK<API>) {
  sdk.events.onInterceptResponse(async (_sdk, request: Request, response: Response) => {
    try {
      // Scope gate: only watch traffic Caido's own active Scope considers in
      // scope. With no scope selected, inScope() has nothing to match against
      // and this plugin must never passively log traffic just because it
      // happens to pass through Caido.
      if (!sdk.requests.inScope(request)) {
        return;
      }

      await processExchange(sdk, request, response);
    } catch (err) {
      const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
      sdk.console.log(`[ai-recon-watcher] error analyzing exchange: ${detail}`);
    }
  });

  sdk.api.register("getSummary", getSummary);
  sdk.api.register("getEndpoints", getEndpoints);
  sdk.api.register("getRecentCaptures", getRecentCaptures);
  sdk.api.register("getSkills", getSkills);
  sdk.api.register("clearCapturedData", clearCapturedData);
  sdk.api.register("analyzeRequestById", analyzeRequestById);

  sdk.console.log("[ai-recon-watcher] initialized - passively watching traffic in Caido's active Scope");
}
