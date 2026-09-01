import type { Request, Response } from "caido:utils";

import {
  AI_HEADER_TAGS,
  AI_JSON_FIELD_NAMES,
  AI_PATH_KEYWORDS,
  CHATBOT_CONFIG_PATTERN,
  CRYPTO_INDICATORS,
  FRAMEWORK_SIGNATURES,
  MAX_ANALYZE_BODY_CHARS,
  ML_ENDPOINT_PATHS,
  SECRET_PATTERNS,
  SECURITY_HEADERS,
  SPAM_ROBOTS_KEYWORDS,
} from "./signatures";

export type FindingCandidate = {
  title: string;
  description: string;
  dedupeKey: string;
};

function findAiHeaders(headers: Record<string, string[]>): Record<string, string> {
  const found: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    const lkey = key.toLowerCase();
    if (AI_HEADER_TAGS.some((tag) => lkey.includes(tag))) {
      found[key] = headers[key]?.[0] ?? "";
    }
  }
  return found;
}

function findSecrets(text: string): string[] {
  const hits: string[] = [];
  for (const [name, pattern] of Object.entries(SECRET_PATTERNS)) {
    if (pattern.test(text)) hits.push(name);
  }
  return hits;
}

function findAiJsonFields(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const found: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (AI_JSON_FIELD_NAMES.has(k.toLowerCase())) {
      found[k] = v;
    }
  }
  return found;
}

function findFrameworkSignature(text: string): string | undefined {
  for (const [framework, patterns] of Object.entries(FRAMEWORK_SIGNATURES)) {
    if (patterns.some((p) => p.test(text))) return framework;
  }
  return undefined;
}

function findRobotsSpam(text: string): string[] {
  const low = text.toLowerCase();
  return SPAM_ROBOTS_KEYWORDS.filter((kw) => low.includes(kw));
}

/**
 * A streamed chat response is NOT a single JSON document - it's a sequence
 * of "data: {...}" lines (Server-Sent Events). A whole-body JSON.parse on
 * one of these always throws, which silently skipped every JSON-based
 * detection (skills, RAG fields, secrets-in-JSON) for exactly the kind of
 * endpoint a modern streaming chatbot is most likely to use.
 */
function isSseBody(contentType: string, text: string): boolean {
  if (/text\/event-stream/i.test(contentType)) return true;
  return /(^|\n)\s*data:\s*/.test(text.slice(0, 500));
}

function parseSseDataChunks(text: string): unknown[] {
  const chunks: unknown[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      chunks.push(JSON.parse(payload));
    } catch {
      // Not a JSON data chunk (plain-text token stream, keepalive, etc.) -
      // fine to skip, JSON-based detection just doesn't apply to this line.
    }
  }
  return chunks;
}

/**
 * Returns every JSON value worth scanning in a body: for a plain JSON
 * response/request that's a single-element array with the whole parsed
 * body; for an SSE stream it's one element per "data:" chunk. Unifies the
 * two shapes so downstream detection (findAiJsonFields, findToolCalls)
 * doesn't need to know which kind of body it's looking at.
 */
function extractJsonNodes(contentType: string, text: string): unknown[] {
  if (isSseBody(contentType, text)) {
    return parseSseDataChunks(text);
  }
  try {
    return [JSON.parse(text)];
  } catch {
    return [];
  }
}

export type ToolCallHit = {
  name: string;
  argsSummary: string;
  source: "request" | "response";
};

const TOOL_NAME_KEYS = ["tool_name", "tool", "skill", "skill_name", "action"];
const TOOL_ARGS_KEYS = ["arguments", "input", "parameters", "args"];
// Fields that hold a *list* of skill/tool names already used for this turn,
// as either a native array or (commonly seen on custom/proprietary chat
// backends) a JSON-stringified array packed into a string value, e.g.
// "useSkills": "[\"web_search\", \"weather_lookup\"]".
const SKILLS_LIST_KEYS = [
  "useSkills",
  "usedSkills",
  "skillsUsed",
  "skills_used",
  "toolsUsed",
  "tools_used",
  "usedTools",
];
const MAX_TOOL_SCAN_DEPTH = 8;

function extractSkillListNames(value: unknown): string[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/**
 * Recursively scans a parsed JSON body (request OR response - tool/skill
 * signals can appear in either, e.g. a client declaring which skills to
 * enable, or conversation history round-tripped back with prior tool
 * calls/results) for tool/function/skill invocation shapes. The model or
 * client naming a capability is exactly the kind of self-describing
 * agent-capability signal that's valuable to map, per the same logic that
 * makes MCP tool schemas "free recon". Covers:
 *   - OpenAI-style: { type: "function", function: { name, arguments } }
 *   - OpenAI legacy: { function_call: { name, arguments } }
 *   - Anthropic-style: { type: "tool_use", name, input }
 *   - MCP JSON-RPC: { method: "tools/call", params: { name, arguments } }
 *   - Generic custom agents: a name-ish field (tool/skill/action) with a
 *     sibling arguments-ish field (input/parameters/args)
 *   - Skills-list fields: useSkills/toolsUsed/etc holding an array (or a
 *     JSON-stringified array) of skill-name strings
 */
function findToolCalls(
  node: unknown,
  source: "request" | "response",
  depth = 0,
  results: ToolCallHit[] = [],
): ToolCallHit[] {
  if (depth > MAX_TOOL_SCAN_DEPTH || node === null || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) findToolCalls(item, source, depth + 1, results);
    return results;
  }

  const obj = node as Record<string, unknown>;
  const push = (name: unknown, args: unknown) => {
    if (typeof name === "string" && name.length > 0) {
      results.push({ name, argsSummary: JSON.stringify(args ?? null).slice(0, 500), source });
    }
  };

  if (obj.type === "function" && obj.function && typeof obj.function === "object") {
    const fn = obj.function as Record<string, unknown>;
    push(fn.name, fn.arguments);
  }

  if (obj.function_call && typeof obj.function_call === "object") {
    const fc = obj.function_call as Record<string, unknown>;
    push(fc.name, fc.arguments);
  }

  for (const key of SKILLS_LIST_KEYS) {
    if (key in obj) {
      for (const name of extractSkillListNames(obj[key])) {
        push(name, undefined);
      }
    }
  }

  if (obj.type === "tool_use") {
    push(obj.name, obj.input);
  }

  if (obj.method === "tools/call" && obj.params && typeof obj.params === "object") {
    const params = obj.params as Record<string, unknown>;
    push(params.name, params.arguments);
  }

  const nameKey = TOOL_NAME_KEYS.find((k) => typeof obj[k] === "string");
  if (nameKey) {
    const argsKey = TOOL_ARGS_KEYS.find((k) => k in obj);
    push(obj[nameKey], argsKey ? obj[argsKey] : undefined);
  }

  for (const value of Object.values(obj)) {
    findToolCalls(value, source, depth + 1, results);
  }

  return results;
}

export function analyzeExchange(
  request: Request,
  response: Response,
  responseBodyText: string,
) {
  const host = request.getHost();
  const path = request.getPath();
  const method = request.getMethod();
  const reqHeaders = request.getHeaders();
  const resHeaders = response.getHeaders();

  const findings: FindingCandidate[] = [];

  const serverBanner = response.getHeader("server")?.[0];
  const poweredBy = response.getHeader("x-powered-by")?.[0];
  if (serverBanner || poweredBy) {
    findings.push({
      title: `Server/technology banner disclosed on ${host}`,
      description: `Server: ${serverBanner ?? "n/a"} | X-Powered-By: ${poweredBy ?? "n/a"}`,
      dedupeKey: `${host}-tech-banner`,
    });
  }

  const aiHeaders = findAiHeaders(resHeaders);
  const hasAiHeaders = Object.keys(aiHeaders).length > 0;
  if (hasAiHeaders) {
    findings.push({
      title: `AI/RAG/MCP-specific header disclosed on ${host}${path}`,
      description: `Headers: ${JSON.stringify(aiHeaders)}`,
      dedupeKey: `${host}-ai-headers`,
    });
  }

  // Check every value, not just the first - a response can carry the same
  // header more than once, and the wildcard isn't guaranteed to be first.
  const corsValues = response.getHeader("access-control-allow-origin");
  if (corsValues?.includes("*")) {
    findings.push({
      title: `Wildcard CORS policy on ${host}`,
      description: "Access-Control-Allow-Origin: * - any origin can call this API directly.",
      dedupeKey: `${host}-cors-wildcard`,
    });
  }

  const missingSecurityHeaders = SECURITY_HEADERS.filter(
    (h) => response.getHeader(h) === undefined,
  );
  if (missingSecurityHeaders.length >= 3) {
    findings.push({
      title: `Multiple security headers missing on ${host}`,
      description: `Missing: ${missingSecurityHeaders.join(", ")}`,
      dedupeKey: `${host}-missing-security-headers`,
    });
  }

  // Cap what gets regex/JSON-scanned - see MAX_ANALYZE_BODY_CHARS.
  const analyzedText =
    responseBodyText.length > MAX_ANALYZE_BODY_CHARS
      ? responseBodyText.slice(0, MAX_ANALYZE_BODY_CHARS)
      : responseBodyText;

  const requestBody = request.getBody();
  const requestBodyText = requestBody ? requestBody.toText() : "";
  const analyzedRequestText =
    requestBodyText.length > MAX_ANALYZE_BODY_CHARS
      ? requestBodyText.slice(0, MAX_ANALYZE_BODY_CHARS)
      : requestBodyText;

  const contentType = response.getHeader("content-type")?.[0] ?? "";
  const requestContentType = request.getHeader("content-type")?.[0] ?? "";

  const secretHits = findSecrets(analyzedText);
  for (const secretType of secretHits) {
    findings.push({
      title: `Possible ${secretType} exposed in response body on ${host}${path}`,
      description: `Pattern for '${secretType}' matched in the response body - verify and rotate if real.`,
      dedupeKey: `${host}-${path}-secret-${secretType}`,
    });
  }

  // Handles both a plain single JSON body and an SSE token stream (one
  // node per "data:" chunk) uniformly - see extractJsonNodes.
  const responseJsonNodes = extractJsonNodes(contentType, analyzedText);

  const aiFields: Record<string, unknown> = {};
  for (const node of responseJsonNodes) {
    Object.assign(aiFields, findAiJsonFields(node));
  }
  const isAiRelated = Object.keys(aiFields).length > 0;
  // Bounded string form used for both the finding text and stored data -
  // matched field values could themselves contain large/sensitive payloads,
  // so this is capped the same way bodySnippet is below.
  const aiFieldsSummary = JSON.stringify(aiFields).slice(0, 1000);
  if (isAiRelated) {
    findings.push({
      title: `AI-related fields disclosed in JSON response on ${host}${path}`,
      description: `Fields: ${aiFieldsSummary}`,
      dedupeKey: `${host}-${path}-ai-fields`,
    });
  }

  // Exact match only - endsWith previously matched unrelated paths that
  // merely happened to share a suffix, e.g. "/support/api/chat".
  const isMlEndpoint = ML_ENDPOINT_PATHS.includes(path);
  if (isMlEndpoint) {
    findings.push({
      title: `ML-idiomatic endpoint discovered: ${method} ${path} on ${host}`,
      description: "Path naming matches common LLM/ML API conventions.",
      dedupeKey: `${host}-${path}-ai-endpoint`,
    });
  }

  // Broader, lower-confidence than the exact-match list above: catches
  // custom/proprietary chat APIs (not built on an OpenAI-compatible SDK)
  // that use their own path naming, e.g. "/executechatserviceChat".
  const lowerPath = path.toLowerCase();
  const matchedKeyword = AI_PATH_KEYWORDS.find((kw) => lowerPath.includes(kw));
  const isAiPathKeyword = !isMlEndpoint && matchedKeyword !== undefined;
  if (isAiPathKeyword) {
    findings.push({
      title: `Possible AI/chat endpoint by path naming: ${method} ${path} on ${host}`,
      description: `Path contains AI-related keyword '${matchedKeyword}' - lower confidence than an exact ML-endpoint match, verify manually.`,
      dedupeKey: `${host}-${path}-ai-path-keyword`,
    });
  }

  if (response.getCode() >= 400) {
    const framework = findFrameworkSignature(analyzedText);
    if (framework) {
      findings.push({
        title: `Orchestration framework fingerprinted via error response: ${framework}`,
        description: `Stack trace/error signature for '${framework}' found in a ${response.getCode()} response on ${host}${path}.`,
        dedupeKey: `${host}-framework-${framework}`,
      });
    }
  }

  if (path === "/robots.txt" || path.endsWith("/robots.txt")) {
    const spamHits = findRobotsSpam(analyzedText);
    if (spamHits.length > 0) {
      findings.push({
        title: `robots.txt contains spam-indicator entries on ${host}`,
        description: `Matched keywords: ${spamHits.join(", ")} - a classic sign of prior SEO-spam compromise; check whether the referenced content is still reachable.`,
        dedupeKey: `${host}-robots-spam`,
      });
    }
  }

  const looksLikeJs = /javascript|ecmascript/i.test(contentType) || /\.js(?:$|[?#])/i.test(path);
  if (looksLikeJs) {
    const cryptoHits = CRYPTO_INDICATORS.filter((indicator) => analyzedText.includes(indicator));
    if (cryptoHits.length > 0) {
      findings.push({
        title: `Client-side crypto/obfuscation library referenced in JS on ${host}${path}`,
        description: `Indicators: ${cryptoHits.join(", ")} - this target likely encrypts/obfuscates requests client-side; not a real confidentiality boundary since the routine ships in this same file.`,
        dedupeKey: `${host}-${path}-js-crypto`,
      });
    }
    if (CHATBOT_CONFIG_PATTERN.test(analyzedText)) {
      findings.push({
        title: `Chatbot/API configuration object found in JS on ${host}${path}`,
        description: "Found a window.__*CONFIG*__/assistantEndpoint/apiBase-style pattern - may reveal internal endpoint paths or feature flags.",
        dedupeKey: `${host}-${path}-js-config`,
      });
    }
  }

  // Request bodies are effectively never SSE themselves, but reusing the
  // same extractor keeps request/response handling identical - it just
  // resolves to a single-element array for a normal JSON request body.
  const requestJsonNodes = extractJsonNodes(requestContentType, analyzedRequestText);

  const toolCalls: ToolCallHit[] = [];
  for (const node of requestJsonNodes) findToolCalls(node, "request", 0, toolCalls);
  for (const node of responseJsonNodes) findToolCalls(node, "response", 0, toolCalls);
  const seenToolNames = new Set<string>();
  for (const call of toolCalls) {
    if (seenToolNames.has(call.name)) continue;
    seenToolNames.add(call.name);
    findings.push({
      title: `AI tool/skill invoked: ${call.name} on ${host}`,
      description: `Arguments observed: ${call.argsSummary} (seen in: ${call.source})`,
      dedupeKey: `${host}-skill-${call.name}`,
    });
  }

  const data = {
    request: {
      method,
      host,
      port: request.getPort(),
      path,
      query: request.getQuery(),
      headers: reqHeaders,
    },
    response: {
      statusCode: response.getCode(),
      headers: resHeaders,
      roundtripMs: response.getRoundtripTime(),
      bodySnippet: responseBodyText.slice(0, 2000),
      aiFields: aiFieldsSummary,
    },
  };

  return {
    data,
    aiRelated: isAiRelated || isMlEndpoint || isAiPathKeyword || hasAiHeaders || toolCalls.length > 0,
    findings,
    toolCalls,
  };
}
