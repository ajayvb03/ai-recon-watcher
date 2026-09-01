import { defineConfig } from "@caido-community/dev";

const id = "ai-recon-watcher";

export default defineConfig({
  id,
  name: "AI Recon Watcher",
  description:
    "Passively watches HTTP traffic through Caido, stores every request/response as JSON, and flags tech-stack, AI-system, and attack-surface signals as Findings - no active probing.",
  version: "0.6.1",
  author: {
    name: "ajayvb03",
    email: "ajaybechawade@gmail.com",
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
