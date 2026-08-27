import type { CaptureRow, EndpointRow, TargetDomain } from "backend";

export type TargetDomainsHandle = {
  element: HTMLElement;
  input: HTMLInputElement;
  addButton: HTMLButtonElement;
  list: HTMLElement;
};

export function targetDomainsSection(domains: TargetDomain[]): TargetDomainsHandle {
  const wrapper = document.createElement("div");
  wrapper.className = "arw-section";

  const title = document.createElement("h3");
  title.textContent = "Target Scope";
  wrapper.appendChild(title);

  const hint = document.createElement("p");
  hint.className = "arw-empty";
  hint.textContent =
    "Only traffic to these hosts is captured and analyzed. Add every host the chatbot uses - the web frontend and its API backend are often different domains.";
  wrapper.appendChild(hint);

  const row = document.createElement("div");
  row.className = "arw-domain-input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "arw-domain-input";
  input.placeholder = "example.com or https://example.com/chat";
  row.appendChild(input);

  const addButton = document.createElement("button");
  addButton.className = "arw-refresh";
  addButton.textContent = "Add";
  row.appendChild(addButton);

  wrapper.appendChild(row);

  const list = document.createElement("div");
  list.className = "arw-domain-list";

  if (domains.length === 0) {
    const empty = document.createElement("p");
    empty.className = "arw-empty";
    empty.textContent = "No target domains configured - nothing is being captured yet.";
    list.appendChild(empty);
  } else {
    for (const d of domains) {
      const chip = document.createElement("span");
      chip.className = "arw-domain-chip";
      const hostText = document.createElement("span");
      hostText.textContent = d.host;
      chip.appendChild(hostText);
      const removeBtn = document.createElement("button");
      removeBtn.className = "arw-domain-remove";
      removeBtn.dataset.host = d.host;
      removeBtn.textContent = "×";
      chip.appendChild(removeBtn);
      list.appendChild(chip);
    }
  }
  wrapper.appendChild(list);

  return { element: wrapper, input, addButton, list };
}

export function statCard(label: string, value: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "arw-card";
  card.innerHTML = `
    <div class="arw-card-value">${value}</div>
    <div class="arw-card-label">${escapeHtml(label)}</div>
  `;
  return card;
}

export function endpointsTable(rows: EndpointRow[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "arw-section";

  const title = document.createElement("h3");
  title.textContent = "Discovered Endpoints (attack surface)";
  wrapper.appendChild(title);

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "arw-empty";
    empty.textContent = "No traffic observed yet - browse the target through Caido to populate this.";
    wrapper.appendChild(empty);
    return wrapper;
  }

  const search = document.createElement("input");
  search.type = "text";
  search.className = "arw-search";
  search.placeholder = "Filter by host, path, or method...";
  wrapper.appendChild(search);

  const tableContainer = document.createElement("div");
  wrapper.appendChild(tableContainer);

  const renderRows = (query: string) => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.host.toLowerCase().includes(q) ||
            r.path.toLowerCase().includes(q) ||
            r.method.toLowerCase().includes(q),
        )
      : rows;

    tableContainer.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "arw-empty";
      empty.textContent = "No endpoints match your filter.";
      tableContainer.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "arw-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Method</th>
          <th>Path</th>
          <th>Host</th>
          <th>Hits</th>
          <th>AI-related</th>
          <th>First seen</th>
          <th>Last seen</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (r) => `
          <tr>
            <td><span class="arw-method">${escapeHtml(r.method)}</span></td>
            <td>${escapeHtml(r.path)}</td>
            <td>${escapeHtml(r.host)}</td>
            <td>${r.hit_count}</td>
            <td>${r.ai_related ? '<span class="arw-badge">AI</span>' : ""}</td>
            <td>${formatDate(r.first_seen)}</td>
            <td>${formatDate(r.last_seen)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    `;
    tableContainer.appendChild(table);
  };

  search.addEventListener("input", () => renderRows(search.value));
  renderRows("");

  return wrapper;
}

export function capturesLog(rows: CaptureRow[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "arw-section";

  const title = document.createElement("h3");
  title.textContent = "Recent Captures (raw JSON store)";
  wrapper.appendChild(title);

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "arw-empty";
    empty.textContent = "Nothing captured yet.";
    wrapper.appendChild(empty);
    return wrapper;
  }

  const search = document.createElement("input");
  search.type = "text";
  search.className = "arw-search";
  search.placeholder = "Filter by host, path, method, or status...";
  wrapper.appendChild(search);

  const listContainer = document.createElement("div");
  wrapper.appendChild(listContainer);

  const renderRows = (query: string) => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (row) =>
            row.host.toLowerCase().includes(q) ||
            row.path.toLowerCase().includes(q) ||
            row.method.toLowerCase().includes(q) ||
            String(row.status_code).includes(q),
        )
      : rows;

    listContainer.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "arw-empty";
      empty.textContent = "No captures match your filter.";
      listContainer.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "arw-capture-list";

    for (const row of filtered) {
      const item = document.createElement("details");
      item.className = "arw-capture-item";

      const summary = document.createElement("summary");
      summary.innerHTML = `
        <span class="arw-method">${escapeHtml(row.method)}</span>
        <span>${escapeHtml(row.path)}</span>
        <span class="arw-muted">${escapeHtml(row.host)}</span>
        <span class="arw-status arw-status-${statusClass(row.status_code)}">${row.status_code}</span>
        <span class="arw-muted">${row.roundtrip_ms}ms</span>
        <span class="arw-muted">${formatDate(row.created_at)}</span>
      `;
      item.appendChild(summary);

      const pre = document.createElement("pre");
      pre.className = "arw-json";
      try {
        pre.textContent = JSON.stringify(JSON.parse(row.data), null, 2);
      } catch {
        pre.textContent = row.data;
      }
      item.appendChild(pre);

      list.appendChild(item);
    }

    listContainer.appendChild(list);
  };

  search.addEventListener("input", () => renderRows(search.value));
  renderRows("");

  return wrapper;
}

function statusClass(code: number): string {
  if (code >= 500) return "error";
  if (code >= 400) return "warn";
  return "ok";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export const STYLES = `
  #plugin--ai-recon-watcher {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    font-family: inherit;
  }
  #plugin--ai-recon-watcher .arw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  #plugin--ai-recon-watcher h2 { margin: 0; }
  #plugin--ai-recon-watcher .arw-refresh {
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 4px;
    border: 1px solid rgba(128,128,128,0.4);
    background: transparent;
    color: inherit;
  }
  #plugin--ai-recon-watcher .arw-refresh:hover { background: rgba(128,128,128,0.15); }
  #plugin--ai-recon-watcher .arw-stats {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  #plugin--ai-recon-watcher .arw-card {
    flex: 1;
    border: 1px solid rgba(128,128,128,0.3);
    border-radius: 6px;
    padding: 12px 16px;
    text-align: center;
  }
  #plugin--ai-recon-watcher .arw-card-value { font-size: 24px; font-weight: 600; }
  #plugin--ai-recon-watcher .arw-card-label { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  #plugin--ai-recon-watcher .arw-section { margin-bottom: 24px; }
  #plugin--ai-recon-watcher .arw-section h3 { margin: 0 0 8px 0; font-size: 14px; opacity: 0.85; }
  #plugin--ai-recon-watcher .arw-empty { opacity: 0.6; font-size: 13px; }
  #plugin--ai-recon-watcher .arw-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  #plugin--ai-recon-watcher .arw-table th, #plugin--ai-recon-watcher .arw-table td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(128,128,128,0.2);
  }
  #plugin--ai-recon-watcher .arw-method {
    font-family: monospace;
    font-weight: 600;
  }
  #plugin--ai-recon-watcher .arw-badge {
    background: #7c3aed;
    color: white;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
  }
  #plugin--ai-recon-watcher .arw-capture-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  #plugin--ai-recon-watcher .arw-capture-item {
    border: 1px solid rgba(128,128,128,0.2);
    border-radius: 4px;
    padding: 4px 8px;
  }
  #plugin--ai-recon-watcher .arw-capture-item summary {
    cursor: pointer;
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 13px;
  }
  #plugin--ai-recon-watcher .arw-muted { opacity: 0.6; font-size: 12px; }
  #plugin--ai-recon-watcher .arw-status { font-size: 11px; padding: 1px 6px; border-radius: 3px; }
  #plugin--ai-recon-watcher .arw-status-ok { background: #16a34a33; color: #22c55e; }
  #plugin--ai-recon-watcher .arw-status-warn { background: #ca8a0433; color: #eab308; }
  #plugin--ai-recon-watcher .arw-status-error { background: #dc262633; color: #ef4444; }
  #plugin--ai-recon-watcher .arw-json {
    margin-top: 8px;
    font-size: 12px;
    max-height: 300px;
    overflow: auto;
    background: rgba(128,128,128,0.08);
    padding: 8px;
    border-radius: 4px;
  }
  #plugin--ai-recon-watcher .arw-domain-input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  #plugin--ai-recon-watcher .arw-domain-input {
    flex: 1;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid rgba(128,128,128,0.4);
    background: transparent;
    color: inherit;
    font-size: 13px;
  }
  #plugin--ai-recon-watcher .arw-domain-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  #plugin--ai-recon-watcher .arw-domain-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(124,58,237,0.15);
    border: 1px solid rgba(124,58,237,0.4);
    border-radius: 999px;
    padding: 4px 6px 4px 12px;
    font-size: 12px;
    font-family: monospace;
  }
  #plugin--ai-recon-watcher .arw-domain-remove {
    cursor: pointer;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 14px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 999px;
  }
  #plugin--ai-recon-watcher .arw-domain-remove:hover { background: rgba(128,128,128,0.25); }
  #plugin--ai-recon-watcher .arw-search {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    margin-bottom: 8px;
    border-radius: 4px;
    border: 1px solid rgba(128,128,128,0.4);
    background: transparent;
    color: inherit;
    font-size: 13px;
  }
  #plugin--ai-recon-watcher .arw-danger {
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 4px;
    border: 1px solid rgba(220,38,38,0.5);
    background: transparent;
    color: #ef4444;
  }
  #plugin--ai-recon-watcher .arw-danger:hover { background: rgba(220,38,38,0.15); }
`;
