import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { defineConfig as definePackConfig } from "vite-plus/pack";

const islandsEntry = fileURLToPath(new URL("../ox-content-islands/src/index.ts", import.meta.url));
const islandsHtmlHostEntry = fileURLToPath(
  new URL("../ox-content-islands/src/html-host.ts", import.meta.url),
);

export default defineConfig({
  fmt: {
    ignorePatterns: ["dist/**"],
  },
  test: {
    alias: [
      { find: "@ox-content/islands/html-host", replacement: islandsHtmlHostEntry },
      { find: "@ox-content/islands", replacement: islandsEntry },
    ],
  },
  pack: definePackConfig({
    entry: ["src/index.ts", "src/html-host-client.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    hash: false,
    deps: {
      neverBundle: ["vite", "svelte", "svelte/server", "@ox-content/vite-plugin"],
    },
  }),
});
