# AI Recon Watcher

A [Caido](https://caido.io) plugin that passively watches HTTP traffic already flowing through
your proxy and flags tech-stack, AI-system, and attack-surface signals as Findings — no active
probing, no traffic generated, no requests you didn't already make yourself.

Built for security researchers doing recon against AI-backed chatbots, agents, and RAG pipelines:
it turns everything you've already captured into a running picture of what a target is built on,
what endpoints it exposes, and what tools/skills its model is actually invoking — instead of
piecing that together by hand from dozens of individual requests.

## What it does

- **Captures every request/response** in Caido's active **Scope** (see below) as structured JSON,
  browsable and searchable from a dashboard tab inside Caido.
- **Flags tech-stack and AI-system signals** as Caido Findings: server/framework fingerprints,
  AI/RAG/MCP-related headers, exposed model/provider/citation fields in JSON responses, secrets
  accidentally present in bodies (API keys, JWTs, private keys), missing security headers, a
  wide-open CORS policy, and framework fingerprints on error responses.
- **Maps the Skills/Tools surface**: detects when a target's model invokes a tool or function —
  OpenAI-style `function`/`function_call`, Anthropic-style `tool_use`, MCP `tools/call`, and
  generic custom conventions (including skill lists packed as JSON-stringified strings) — scanned
  in both request and response bodies, including **Server-Sent Events / streaming** responses
  parsed chunk-by-chunk. Builds a running "skills seen per host" table so you can see an agent's
  actual capability surface without asking it.
- **Exports a Markdown report** of everything captured — active scope, endpoints, skills map,
  recent captures — for dropping straight into a writeup.

## What it explicitly does *not* do

No active probing, no crafted requests, no fuzzing, no automated attacks. It only ever looks at
traffic that passed through Caido because you (or another tool) already sent it. If you want to
send adversarial test payloads to a target, that's a different kind of tool with a different trust
model — this one's job is to make sense of what's already there.

## Scope — uses Caido's built-in Scope, not its own

The plugin has no scope system of its own — it uses Caido's native **Scope** feature
(`sdk.requests.inScope`). Traffic outside your currently selected Scope is ignored entirely; it's
never captured in the first place, not filtered out after the fact. With no Scope selected,
nothing is captured. This keeps the plugin from silently hoovering up every domain your browser
happens to talk to, and means Scope is managed in one place across all of Caido, not duplicated
per-plugin.

## Using it

1. Install the plugin (see Installation below) and open the **AI Recon Watcher** tab from the
   Caido sidebar.
2. Select (or create) a **Scope** in Caido that covers the target you're testing.
3. Browse the target normally, or trigger requests through Caido's Proxy/Replay as usual. Traffic
   inside the active Scope is captured and analyzed automatically. The dashboard shows which Scope
   is currently active, so it's obvious when nothing is being captured because none is selected.
4. Already have a request in Caido's history from before you set your Scope? Right-click it (in
   the request list, the request editor, or a response) and choose **Send to AI Recon Watcher** —
   it analyzes that exchange immediately regardless of Scope, so you don't have to wait for new
   traffic.
5. Check the **Findings** panel for flagged signals, and the dashboard's Skills/Tools table for
   any detected tool/function invocations.
6. Use **Export Report** for a Markdown summary, or **Clear Data** to wipe captured
   captures/endpoints/skills.

## Installation

```bash
pnpm install
pnpm build
```

This produces `dist/plugin_package.zip`. In Caido, go to **Plugins → Install**, and select that
file. To update after a rebuild, reinstall the same zip — Caido replaces the existing version.

For active development, `pnpm watch` rebuilds on file changes.

## Architecture

- `packages/backend` — Caido backend plugin: traffic interception (`onInterceptResponse`),
  analysis engine (`analyze.ts`, `signatures.ts`), SQLite persistence (`db.ts`), and the RPC
  surface consumed by the frontend (`api.ts`).
- `packages/frontend` — Vue 3 + PrimeVue dashboard UI: summary stats, active-Scope indicator,
  endpoints table, Skills/Tools map, recent captures log with search, and the right-click
  command/menu integrations.

Findings, captures, discovered endpoints, and detected skills all persist in a SQLite database
managed through Caido's plugin storage — nothing is written outside Caido's own data directory.

## License

MIT
