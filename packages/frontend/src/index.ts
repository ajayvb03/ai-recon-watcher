import { capturesLog, endpointsTable, statCard, STYLES } from "./render";
import type { FrontendSDK } from "./types";

async function renderDashboard(sdk: FrontendSDK, container: HTMLElement) {
  container.innerHTML = "<p class=\"arw-empty\">Loading...</p>";

  let summary, endpoints, captures;
  try {
    [summary, endpoints, captures] = await Promise.all([
      sdk.backend.getSummary(),
      sdk.backend.getEndpoints(),
      sdk.backend.getRecentCaptures(50),
    ]);
  } catch (err) {
    sdk.log.error(`[ai-recon-watcher] failed to load dashboard data: ${String(err)}`);
    container.innerHTML = `<p class="arw-empty">Failed to load data: ${String(err)}</p>`;
    return;
  }

  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "arw-header";
  header.innerHTML = `<h2>AI Recon Watcher</h2>`;

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "arw-refresh";
  refreshBtn.textContent = "Refresh";
  refreshBtn.addEventListener("click", () => renderDashboard(sdk, container));
  header.appendChild(refreshBtn);

  container.appendChild(header);

  const stats = document.createElement("div");
  stats.className = "arw-stats";
  stats.appendChild(statCard("Total Captures", summary.totalCaptures));
  stats.appendChild(statCard("Endpoints Discovered", summary.totalEndpoints));
  stats.appendChild(statCard("AI-Related Endpoints", summary.aiRelatedEndpoints));
  container.appendChild(stats);

  const note = document.createElement("p");
  note.className = "arw-empty";
  note.textContent =
    "Deeper signals (secrets, CORS, missing headers, framework fingerprints) are reported as Findings - check the Findings panel.";
  container.appendChild(note);

  container.appendChild(endpointsTable(endpoints));
  container.appendChild(capturesLog(captures));
}

export const init = (sdk: FrontendSDK) => {
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  const root = document.createElement("div");
  root.id = "plugin--ai-recon-watcher";
  Object.assign(root.style, { height: "100%", width: "100%" });

  sdk.navigation.addPage("/ai-recon-watcher", {
    body: root,
    onEnter: () => {
      renderDashboard(sdk, root);
    },
  });

  sdk.sidebar.registerItem("AI Recon Watcher", "/ai-recon-watcher", {
    icon: "fas fa-satellite-dish",
  });
};
