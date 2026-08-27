import { capturesLog, endpointsTable, statCard, STYLES, targetDomainsSection } from "./render";
import { buildMarkdownReport, downloadText } from "./report";
import type { FrontendSDK } from "./types";

async function renderDashboard(sdk: FrontendSDK, container: HTMLElement) {
  container.innerHTML = "<p class=\"arw-empty\">Loading...</p>";

  let summary, endpoints, captures, domains;
  try {
    [summary, endpoints, captures, domains] = await Promise.all([
      sdk.backend.getSummary(),
      sdk.backend.getEndpoints(),
      sdk.backend.getRecentCaptures(50),
      sdk.backend.getTargetDomains(),
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

  const headerActions = document.createElement("div");
  headerActions.style.display = "flex";
  headerActions.style.gap = "8px";

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "arw-refresh";
  refreshBtn.textContent = "Refresh";
  refreshBtn.addEventListener("click", () => renderDashboard(sdk, container));
  headerActions.appendChild(refreshBtn);

  const exportBtn = document.createElement("button");
  exportBtn.className = "arw-refresh";
  exportBtn.textContent = "Export Report";
  exportBtn.addEventListener("click", () => {
    const report = buildMarkdownReport({
      totalCaptures: summary.totalCaptures,
      totalEndpoints: summary.totalEndpoints,
      aiRelatedEndpoints: summary.aiRelatedEndpoints,
      domains,
      endpoints,
      captures,
    });
    downloadText(`ai-recon-watcher-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`, report);
  });
  headerActions.appendChild(exportBtn);

  const clearBtn = document.createElement("button");
  clearBtn.className = "arw-danger";
  clearBtn.textContent = "Clear Data";
  clearBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Clear all captured requests/responses and discovered endpoints? Target scope domains are kept. This cannot be undone.",
    );
    if (!confirmed) return;
    try {
      await sdk.backend.clearCapturedData();
      renderDashboard(sdk, container);
    } catch (err) {
      sdk.log.error(`[ai-recon-watcher] failed to clear data: ${String(err)}`);
    }
  });
  headerActions.appendChild(clearBtn);

  header.appendChild(headerActions);
  container.appendChild(header);

  const domainSection = targetDomainsSection(domains);

  const addDomain = async () => {
    const value = domainSection.input.value.trim();
    if (!value) return;
    try {
      await sdk.backend.addTargetDomain(value);
      renderDashboard(sdk, container);
    } catch (err) {
      sdk.log.error(`[ai-recon-watcher] failed to add target domain: ${String(err)}`);
    }
  };
  domainSection.addButton.addEventListener("click", addDomain);
  domainSection.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain();
  });
  domainSection.list.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest<HTMLElement>(".arw-domain-remove");
    const host = removeBtn?.dataset.host;
    if (host) {
      try {
        await sdk.backend.removeTargetDomain(host);
        renderDashboard(sdk, container);
      } catch (err) {
        sdk.log.error(`[ai-recon-watcher] failed to remove target domain: ${String(err)}`);
      }
    }
  });
  container.appendChild(domainSection.element);

  const stats = document.createElement("div");
  stats.className = "arw-stats";
  stats.appendChild(statCard("Total Captures", summary.totalCaptures));
  stats.appendChild(statCard("Endpoints Discovered", summary.totalEndpoints));
  stats.appendChild(statCard("AI-Related Endpoints", summary.aiRelatedEndpoints));
  container.appendChild(stats);

  const note = document.createElement("p");
  note.className = "arw-empty";
  note.textContent =
    "Deeper signals (secrets, CORS, missing headers, framework fingerprints, robots.txt anomalies, JS crypto/config disclosure) are reported as Findings - check the Findings panel.";
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
