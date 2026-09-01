import { defineConfig } from "@caido-community/dev";
import vue from "@vitejs/plugin-vue";
// @ts-expect-error no declared types at this time
import tailwindPrimeui from "tailwindcss-primeui";
import tailwindCaido from "@caido/tailwindcss";
import tailwindcss from "tailwindcss";
import path from "path";
import prefixwrap from "postcss-prefixwrap";

const id = "ai-recon-watcher";

export default defineConfig({
  id,
  name: "AI Recon Watcher",
  description:
    "Passively watches HTTP traffic through Caido, stores every request/response as JSON, and flags tech-stack, AI-system, and attack-surface signals as Findings - no active probing.",
  version: "0.7.2",
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
      vite: {
        plugins: [vue()],
        build: {
          rollupOptions: {
            external: ["vue"],
          },
        },
        resolve: {
          alias: [
            {
              find: "@",
              replacement: path.resolve(__dirname, "packages/frontend/src"),
            },
          ],
        },
        css: {
          postcss: {
            plugins: [
              // Wraps the root element in a unique ID to prevent styling
              // conflicts between plugins.
              prefixwrap(`#plugin--${id}`),

              tailwindcss({
                corePlugins: {
                  preflight: false,
                },
                content: [
                  "./packages/frontend/src/**/*.{vue,ts}",
                  "./node_modules/@caido/primevue/dist/primevue.mjs",
                ],
                // Caido core sets [data-mode="dark"] on <html> to switch themes.
                darkMode: ["selector", '[data-mode="dark"]'],
                plugins: [
                  // Injects Tailwind classes for PrimeVue components.
                  tailwindPrimeui,
                  // Injects Tailwind classes matching the Caido theme.
                  tailwindCaido,
                ],
              }),
            ],
          },
        },
      },
    },
  ],
});
