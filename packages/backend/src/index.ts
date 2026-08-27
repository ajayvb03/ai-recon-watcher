import type { DefineAPI, SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";

import {
  addTargetDomain,
  analyzeRequestById,
  clearCapturedData,
  getEndpoints,
  getRecentCaptures,
  getSkills,
  getSummary,
  getTargetDomains,
  removeTargetDomain,
} from "./api";
import { processExchange } from "./process";

export * from "./api";

export type API = DefineAPI<{
  getSummary: typeof getSummary;
  getEndpoints: typeof getEndpoints;
  getRecentCaptures: typeof getRecentCaptures;
  getSkills: typeof getSkills;
  getTargetDomains: typeof getTargetDomains;
  addTargetDomain: typeof addTargetDomain;
  removeTargetDomain: typeof removeTargetDomain;
  clearCapturedData: typeof clearCapturedData;
  analyzeRequestById: typeof analyzeRequestById;
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
  sdk.api.register("getTargetDomains", getTargetDomains);
  sdk.api.register("addTargetDomain", addTargetDomain);
  sdk.api.register("removeTargetDomain", removeTargetDomain);
  sdk.api.register("clearCapturedData", clearCapturedData);
  sdk.api.register("analyzeRequestById", analyzeRequestById);

  sdk.console.log("[ai-recon-watcher] initialized - passively watching traffic (scoped to configured target domains)");
}
