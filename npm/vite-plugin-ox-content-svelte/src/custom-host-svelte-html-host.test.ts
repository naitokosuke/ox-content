import fs from "node:fs/promises";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { build as viteBuild, type InlineConfig } from "vite";

const tempDirs: string[] = [];
const activeListeners: http.Server[] = [];
const PACKAGE_ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const CORE_ROOT = path.resolve(PACKAGE_ROOT, "../vite-plugin-ox-content");
const ISLANDS_ROOT = path.resolve(PACKAGE_ROOT, "../ox-content-islands");

afterEach(async () => {
  await Promise.all(activeListeners.splice(0).map((server) => closeServer(server)));
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("custom host Svelte HTML host integration", () => {
  it("propagates SSR head and injected styles without hydration duplicates", async () => {
    const root = await createProject("ox-custom-host-svelte-html-host-");
    await writeViteConfig(root);
    await viteBuild(viteConfig(root));
    const html = await fs.readFile(path.join(root, "dist", "probe", "index.html"), "utf8");

    expect(html).toContain('data-diagnostics=""');
    expect(html).toMatch(/<meta name="island-head" content="ready"[^>]*>/u);
    expect(html).toContain("<style");
    expect(html).toContain(".probe");
    expect(html.indexOf('<meta name="island-head"')).toBeLessThan(
      html.indexOf('<script type="module"'),
    );
    expect(html.indexOf("<style")).toBeLessThan(html.indexOf('<script type="module"'));

    const staticServer = await serveDist(root);
    let browser: Browser | undefined;

    try {
      browser = await chromium.launch({
        channel: process.env.CI ? "chrome" : undefined,
        headless: true,
      });
      const page = await browser.newPage();
      const response = await page.goto(`http://127.0.0.1:${staticServer.port}/docs/probe/`);
      expect(response?.status()).toBe(200);

      const state = await page.evaluate(() => {
        const probe = document.querySelector(".probe");
        const styleTags = [...document.head.querySelectorAll("style")].filter((style) =>
          style.textContent?.includes(".probe"),
        );
        return {
          buttonCount: document.querySelectorAll("button.probe").length,
          color: probe ? getComputedStyle(probe).color : "",
          headMeta: document.head
            .querySelector('meta[name="island-head"]')
            ?.getAttribute("content"),
          styleTags: styleTags.length,
        };
      });

      expect(state.buttonCount).toBe(1);
      expect(state.color).toBe("rgb(10, 20, 30)");
      expect(state.headMeta).toBe("ready");
      expect(state.styleTags).toBe(1);
    } finally {
      await browser?.close();
    }
  }, 30_000);
});

function viteConfig(root: string): InlineConfig {
  return {
    root,
    configFile: path.join(root, "vite.config.mjs"),
  };
}

async function createProject(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(PACKAGE_ROOT, `.tmp-${prefix}`));
  tempDirs.push(root);
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "content"), { recursive: true });
  await writeFile(root, "package.json", '{"type":"module"}\n');
  await writeFile(
    root,
    "content/probe.mdx",
    ['import Card from "../src/Card.svelte"', "", "# Probe", "", '<Card label="ready" />', ""].join(
      "\n",
    ),
  );
  await writeFile(root, "src/Card.svelte", cardSource());
  await writeFile(root, "src/client.ts", clientSource());
  await writeFile(root, "src/host.ts", hostSource());
  return root;
}

async function writeViteConfig(root: string): Promise<void> {
  const svelteIndex = path.join(PACKAGE_ROOT, "src", "index.ts");
  const svelteClient = path.join(PACKAGE_ROOT, "src", "html-host-client.ts");
  const coreHtmlHost = path.join(CORE_ROOT, "src", "html-host-public.ts");
  const islandsIndex = path.join(ISLANDS_ROOT, "src", "index.ts");
  const islandsHtmlHost = path.join(ISLANDS_ROOT, "src", "html-host.ts");
  await writeFile(
    root,
    "vite.config.mjs",
    [
      'import path from "node:path";',
      'import { fileURLToPath } from "node:url";',
      'import { oxContentCustomHost } from "@ox-content/vite-plugin";',
      'import { svelte } from "@sveltejs/vite-plugin-svelte";',
      'const root = fileURLToPath(new URL(".", import.meta.url));',
      "export default {",
      '  base: "/docs/",',
      "  appType: 'custom',",
      "  logLevel: 'silent',",
      "  plugins: [",
      "    svelte({ configFile: false, compilerOptions: { css: 'injected' } }),",
      "    htmlHostModules(),",
      "    ...oxContentCustomHost({",
      '      host: "./src/host.ts",',
      "      oxContent: {",
      '        base: "/docs/",',
      '        srcDir: "content",',
      '        outDir: "dist",',
      "        resources: false,",
      "        docs: false,",
      "        search: false,",
      "        ogViewer: false,",
      "        feeds: false,",
      "        siteMaps: false,",
      "      },",
      "      build: { transformHtml: false, runInTest: true },",
      "      dev: { transformHtml: false },",
      "    }),",
      "  ],",
      "  resolve: { alias: [",
      alias("@ox-content/vite-plugin-svelte/html-host/client", svelteClient),
      alias("@ox-content/vite-plugin-svelte", svelteIndex),
      alias("@ox-content/vite-plugin/html-host", coreHtmlHost),
      alias("@ox-content/islands/html-host", islandsHtmlHost),
      alias("@ox-content/islands", islandsIndex),
      "  ] },",
      `  server: { fs: { allow: [root, ${JSON.stringify(PACKAGE_ROOT)}, ${JSON.stringify(CORE_ROOT)}, ${JSON.stringify(ISLANDS_ROOT)}] } },`,
      "  build: {",
      '    outDir: "dist",',
      "    emptyOutDir: true,",
      "    manifest: true,",
      "    rollupOptions: { input: { client: path.join(root, 'src', 'client.ts') } },",
      "  },",
      "};",
      htmlHostModulesPluginSource(),
      "",
    ].join("\n"),
  );
}

function alias(find: string, replacement: string): string {
  return `    { find: /^${find.replaceAll("/", "\\/")}$/, replacement: ${JSON.stringify(replacement)} },`;
}

function htmlHostModulesPluginSource(): string {
  return `
function htmlHostModules() {
  const virtualId = 'virtual:ox-content-svelte/html-host/modules';
  const resolvedId = '\\0' + virtualId;
  return {
    name: 'ox-content-svelte-test:html-host-modules',
    resolveId(id) { return id === virtualId ? resolvedId : null; },
    load(id) {
      if (id !== resolvedId) return null;
      return [
        'export const modules = { "/src/Card.svelte": () => import("/src/Card.svelte") };',
        'export const clientModules = [{ name: "Card", moduleId: "/src/Card.svelte", exportName: "default" }];',
        'export default modules;',
      ].join('\\n');
    },
  };
}
`;
}

function cardSource(): string {
  return [
    "<script>",
    "  export let label = '';",
    "</script>",
    "",
    "<svelte:head>",
    '  <meta name="island-head" content="ready">',
    "</svelte:head>",
    "",
    '<button class="probe">{label}</button>',
    "",
    "<style>",
    "  .probe { color: rgb(10, 20, 30); }",
    "</style>",
  ].join("\n");
}

function hostSource(): string {
  return `
import * as path from "node:path";
import { createSvelteHtmlHostRenderer } from "@ox-content/vite-plugin-svelte";

export default {
  routes: [
    {
      path: "/probe",
      async render(ctx) {
        const renderIslands = createSvelteHtmlHostRenderer({
          root: ctx.root,
          loadModule: (moduleId) => ctx.loadModule(toViteModuleId(moduleId, ctx.root)),
        });
        const rendered = await renderIslands(
          [
            "<h1>Probe</h1>",
            '<div data-ox-island="Card">',
            '<script type="application/json">{"props":{"label":"ready"},"expressions":{},"spreads":[]}</script>',
            "</div>",
          ].join(""),
          {
            documentPath: path.join(ctx.root, "content", "probe.mdx"),
            imports: [
              {
                source: "../src/Card.svelte",
                specifiers: [{ imported: "default", local: "Card", kind: "default" }],
              },
            ],
          },
        );
        const styles = ctx.assets.stylesheets({
          modules: rendered.clientModules.map((module) => module.moduleId),
        });
        const assets = ctx.assets.document({
          head: rendered.headHtml,
          islandStyles: styles.stylesheets,
          clientEntries: ["src/client.ts"],
        });
        const diagnostics = [
          ...rendered.diagnostics,
          ...styles.diagnostics,
        ].map((diagnostic) => diagnostic.code).join(",");
        return {
          html: "<!doctype html><html><head>" + assets.headHtml + "</head><body data-diagnostics=\\"" + diagnostics + "\\">" + rendered.html + "</body></html>",
          dependencies: styles.dependencies,
        };
      },
    },
  ],
};

function toViteModuleId(moduleId, root) {
  if (!path.isAbsolute(moduleId) || !moduleId.startsWith(root)) {
    return moduleId;
  }
  return "/" + path.relative(root, moduleId).replace(/\\\\/g, "/");
}
`;
}

function clientSource(): string {
  return `
import { initIslands } from "@ox-content/islands";
import {
  initSvelteHtmlHost,
  loadSvelteHtmlHostDomRuntime,
} from "@ox-content/vite-plugin-svelte/html-host/client";
import modules from "virtual:ox-content-svelte/html-host/modules";

initSvelteHtmlHost({
  initIslands,
  modules,
  loadRuntime: loadSvelteHtmlHostDomRuntime,
  mount: { mode: "hydrate" },
});
`;
}

async function writeFile(root: string, file: string, content: string): Promise<void> {
  await fs.writeFile(path.join(root, ...file.split("/")), content);
}

async function serveDist(root: string): Promise<{ port: number }> {
  const dist = path.join(root, "dist");
  const listener = http.createServer(async (req, res) => {
    const requestPath = new URL(req.url ?? "/", "http://localhost").pathname;
    const relative = requestPath.startsWith("/docs/")
      ? requestPath.slice("/docs/".length)
      : requestPath.replace(/^\/+/u, "");
    const decoded = decodeURIComponent(relative || "index.html");
    const file = path.resolve(dist, decoded);
    const candidate = requestPath.endsWith("/") ? path.join(file, "index.html") : file;
    if (!candidate.startsWith(`${dist}${path.sep}`)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    try {
      res.statusCode = 200;
      res.end(await fs.readFile(candidate));
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
  activeListeners.push(listener);
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  return { port: (listener.address() as AddressInfo).port };
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}
