import { defineConfig } from "@caido-community/dev";

const id = "ai-recon-watcher";

export default defineConfig({
  id,
  name: "AI Recon Watcher",
  description:
    "Passively watches HTTP traffic through Caido, stores every request/response as JSON, and flags tech-stack, AI-system, and attack-surface signals as Findings - no active probing.",
  version: "0.5.0",
  author: {
    name: "Security Lab",
    email: "security-lab@example.com",
  },
  plugins: [
    {
      kind: "backend",
      id: "backend",
      root: "packages/backend",
    },
    {
      kind: "frontend",
      id: "frontend",
      root: "packages/frontend",
      backend: {
        id: "backend",
      },
    },
  ],
});
