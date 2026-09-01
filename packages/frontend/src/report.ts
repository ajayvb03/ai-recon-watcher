import type { CaptureRow, EndpointRow, SkillRow } from "backend";

export function buildMarkdownReport(data: {
  totalCaptures: number;
  totalEndpoints: number;
  aiRelatedEndpoints: number;
  scopeName?: string;
  endpoints: EndpointRow[];
  captures: CaptureRow[];
  skills: SkillRow[];
}): string {
  const lines: string[] = [];
  lines.push("# AI Recon Watcher Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Active Scope");
  lines.push(`- ${data.scopeName ?? "(none selected in Caido)"}`);
  lines.push("");

  lines.push("## Summary");
  lines.push(`- Total Captures: ${data.totalCaptures}`);
  lines.push(`- Endpoints Discovered: ${data.totalEndpoints}`);
  lines.push(`- AI-Related Endpoints: ${data.aiRelatedEndpoints}`);
  lines.push("");
  lines.push(
    "Deeper signals (secrets, CORS, missing headers, framework fingerprints, robots.txt anomalies, JS crypto/config disclosure) are reported as Caido Findings and are not duplicated in this export - see the Findings panel.",
  );
  lines.push("");

  lines.push("## Discovered Endpoints");
  if (data.endpoints.length === 0) {
    lines.push("(none yet)");
  } else {
    lines.push("| Method | Path | Host | Hits | AI-related | First seen | Last seen |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const e of data.endpoints) {
      lines.push(
        `| ${e.method} | ${e.path} | ${e.host} | ${e.hit_count} | ${e.ai_related ? "yes" : ""} | ${e.first_seen} | ${e.last_seen} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Skills / Tools Map (agent capability surface)");
  if (data.skills.length === 0) {
    lines.push("(none detected yet)");
  } else {
    lines.push("| Skill / Tool | Host | Calls | Seen in | First seen | Last seen | Last arguments |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const s of data.skills) {
      lines.push(
        `| ${s.skill_name} | ${s.host} | ${s.call_count} | ${s.last_source} | ${s.first_seen} | ${s.last_seen} | ${s.last_args.replace(/\|/g, "\\|")} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Recent Captures");
  if (data.captures.length === 0) {
    lines.push("(none yet)");
  } else {
    for (const c of data.captures) {
      lines.push(`### ${c.method} ${c.path} (${c.host}) - ${c.status_code}`);
      lines.push(`- Time: ${c.created_at}`);
      lines.push(`- Roundtrip: ${c.roundtrip_ms}ms`);
      lines.push("```json");
      try {
        lines.push(JSON.stringify(JSON.parse(c.data), null, 2));
      } catch {
        lines.push(c.data);
      }
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function downloadText(filename: string, content: string, mime = "text/markdown"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
