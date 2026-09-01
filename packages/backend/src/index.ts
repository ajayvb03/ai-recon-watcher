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
      // Scope gate: only watch traffic matching one of Caido's saved Scopes.
      // inScope(request) with no scopes argument falls back to whatever
      // Caido considers its ambient "default" - which, with nothing defined,
      // resolves permissively (everything matches) rather than restrictively.
      // That's the right default for Caido's own history/sitemap filtering,
      // but wrong for a passive watcher that must never capture outside an
      // explicit engagement boundary. So: fail closed when no Scope exists at
      // all, and otherwise check explicitly against every saved Scope rather
      // than relying on whichever one happens to be selected in the switcher.
      const scopes = await sdk.scope.getAll();
      if (scopes.length === 0 || !sdk.requests.inScope(request, scopes)) {
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
