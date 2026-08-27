import type { Request, Response } from "caido:utils";

import {
  AI_HEADER_TAGS,
  AI_JSON_FIELD_NAMES,
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

  const secretHits = findSecrets(analyzedText);
  for (const secretType of secretHits) {
    findings.push({
      title: `Possible ${secretType} exposed in response body on ${host}${path}`,
      description: `Pattern for '${secretType}' matched in the response body - verify and rotate if real.`,
      dedupeKey: `${host}-${path}-secret-${secretType}`,
    });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(analyzedText);
  } catch {
    parsedBody = undefined;
  }

  const aiFields = findAiJsonFields(parsedBody);
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

  const contentType = response.getHeader("content-type")?.[0] ?? "";
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
    aiRelated: isAiRelated || isMlEndpoint || hasAiHeaders,
    findings,
  };
}
