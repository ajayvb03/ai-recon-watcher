import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import { SDKPlugin } from "./plugins/sdk";
import "./styles/index.css";
import type { FrontendSDK } from "./types";
import App from "./views/App.vue";

export const init = (sdk: FrontendSDK) => {
  const app = createApp(App);

  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });
  app.use(SDKPlugin, sdk);

  const root = document.createElement("div");
  Object.assign(root.style, { height: "100%", width: "100%" });
  root.id = "plugin--ai-recon-watcher";

  app.mount(root);

  sdk.navigation.addPage("/ai-recon-watcher", {
    body: root,
  });

  sdk.sidebar.registerItem("AI Recon Watcher", "/ai-recon-watcher", {
    icon: "fas fa-satellite-dish",
  });

  const SEND_TO_RECON_COMMAND = "ai-recon-watcher.send-to-recon";

  sdk.commands.register(SEND_TO_RECON_COMMAND, {
    name: "Send to AI Recon Watcher",
    group: "AI Recon Watcher",
    run: async (context) => {
      const requestIds: string[] = [];

      if (context.type === "RequestRowContext") {
        for (const r of context.requests) {
          requestIds.push(String(r.id));
        }
      } else if (context.type === "RequestContext") {
        const req = context.request;
        if ("id" in req) requestIds.push(String(req.id));
      } else if (context.type === "ResponseContext") {
        requestIds.push(String(context.request.id));
      } else {
        return;
      }

      for (const requestId of requestIds) {
        try {
          await sdk.backend.analyzeRequestById(requestId);
        } catch (err) {
          sdk.log.error(`[ai-recon-watcher] failed to analyze request ${requestId}: ${String(err)}`);
        }
      }

      sdk.navigation.goTo("/ai-recon-watcher");
    },
  });

  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: SEND_TO_RECON_COMMAND,
    leadingIcon: "fas fa-satellite-dish",
  });
  sdk.menu.registerItem({
    type: "Request",
    commandId: SEND_TO_RECON_COMMAND,
    leadingIcon: "fas fa-satellite-dish",
  });
  sdk.menu.registerItem({
    type: "Response",
    commandId: SEND_TO_RECON_COMMAND,
    leadingIcon: "fas fa-satellite-dish",
  });
};
