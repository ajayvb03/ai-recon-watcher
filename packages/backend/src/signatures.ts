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
  openai_api_key: /sk-[A-Za-z0-9]{20,}/,
  anthropic_api_key: /sk-ant-[A-Za-z0-9_-]{20,}/,
  private_key_pem: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
};

// Plain model/provider disclosure fields, plus RAG source/citation metadata
// fields - the latter can map a target's knowledge-base structure (document
// filenames, chunk IDs) without ever asking "what documents do you have".
export const AI_JSON_FIELD_NAMES = new Set([
  "model",
  "rag",
  "rag_enabled",
  "mcp_enabled",
  "provider",
  "engine",
  "llm",
  "llm_provider",
  "llm_model",
  "sources",
  "citations",
  "retrieved_chunks",
  "context_docs",
  "documents",
  "retrieval_info",
  "grounding_documents",
]);

// Indicators that a JS response implements client-side request
// encryption/obfuscation - never a real confidentiality boundary since the
// routine must ship in the same file, but useful to flag so a raw-payload
// crawler/fuzzer knows it needs to reverse this before it can craft requests.
export const CRYPTO_INDICATORS = [
  "CryptoJS",
  "JSEncrypt",
  "node-forge",
  "forge.min.js",
  "RSA.encrypt",
  "AES.encrypt",
  "publicKeyPem",
  "-----BEGIN PUBLIC KEY-----",
  "sjcl.",
];

// Chatbot widget config objects embedded in JS - reveals internal API
// endpoints/feature flags without needing to guess them.
export const CHATBOT_CONFIG_PATTERN =
  /window\.__[A-Z0-9_]*CONFIG[A-Z0-9_]*__|assistantEndpoint|chatWidget|apiBase\s*[:=]/i;

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

// Lower-confidence, broader signal than ML_ENDPOINT_PATHS: many production
// chatbots (internal/proprietary APIs, not built on an OpenAI-compatible
// SDK) use their own path naming and will never exact-match the list above
// - e.g. a vendor-specific "/restapi/soa2/.../executeChatTurn"-style route.
// Matching on keywords anywhere in the path catches these without needing
// to know the target's exact endpoint conventions in advance.
export const AI_PATH_KEYWORDS = [
  "chat",
  "gpt",
  "llm",
  "assistant",
  "chatbot",
  "copilot",
  "genchat",
  "aichat",
  "aigc",
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
