// Cap how much of a response body gets regex/JSON-scanned. Secrets and
// framework signatures are practically always near the start of small
// JSON/text payloads; without this, a large or binary response (a proxied
// file download, for instance) would force a full multi-pass regex scan
// and a JSON.parse attempt on every single intercepted response.
export const MAX_ANALYZE_BODY_CHARS = 200_000;

export const SECURITY_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "strict-transport-security",
  "referrer-policy",
];

export const SECRET_PATTERNS: Record<string, RegExp> = {
  aws_access_key: /AKIA[0-9A-Z]{16}/,
  google_api_key: /AIza[0-9A-Za-z_-]{35}/,
  github_token: /gh[pousr]_[A-Za-z0-9]{36,}/,
  jwt: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  slack_token: /xox[baprs]-[0-9A-Za-z-]+/,
  stripe_live_key: /sk_live_[0-9A-Za-z]+/,
};

export const AI_JSON_FIELD_NAMES = new Set([
  "model",
  "rag_enabled",
  "mcp_enabled",
  "provider",
  "engine",
  "llm",
  "llm_provider",
  "llm_model",
]);

export const ML_ENDPOINT_PATHS = [
  "/predict",
  "/inference",
  "/embed",
  "/v1/embeddings",
  "/v1/completions",
  "/v1/chat/completions",
  "/api/generate",
  "/api/chat",
  "/v1/models",
];

export const AI_HEADER_TAGS = ["ai-", "rag-", "mcp-", "llm-", "model-"];

export const FRAMEWORK_SIGNATURES: Record<string, RegExp[]> = {
  langchain: [/langchain[._]\w+/i, /File ".*langchain/i],
  semantic_kernel: [/Microsoft\.SemanticKernel/i, /SKException/i],
  llamaindex: [/llama_index/i],
  autogen: [/autogen[._]\w+/i, /pyautogen/i],
  crewai: [/crewai[._]\w+/i],
};

export const SPAM_ROBOTS_KEYWORDS = [
  "viagra",
  "cialis",
  "casino",
  "lottery",
  "betting",
  "loans",
  "porn",
  "replica",
  "essay",
];
