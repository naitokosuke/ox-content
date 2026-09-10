import { describe, expect, it } from "vite-plus/test";
import {
  HtmlHostRenderError,
  createHtmlHostHydrate,
  createHtmlHostRenderer,
  renderHtmlHost,
  renderHtmlHostMarkdown,
  resolveHtmlHostIslandRegistry,
  type HtmlHostFrameworkAdapter,
  type MdxImport,
} from ".";
import type { RenderDocumentAssetsInput } from "./document-assets";

const adapter: HtmlHostFrameworkAdapter = {
  frameworkName: "Test",
  renderComponent: (component, props, slotHtml, context) => {
    const title = props.title;
    return `<strong data-component="${context.component}">${String(component)}:${
      typeof title === "string" || typeof title === "number" ? String(title) : ""
    }:${slotHtml ?? ""}</strong>`;
  },
};

describe("framework-neutral HTML host contract", () => {
  it("renders document-local and registered islands through a framework adapter", async () => {
    const loaded: string[] = [];
    const result = await renderHtmlHost({
      html: [
        '<div data-ox-island="Chart">',
        '<script type="application/json">{"props":{"title":"Revenue"},"expressions":{},"spreads":[]}</script>',
        "<p>slot</p>",
        "</div>",
        '<span data-ox-island="Badge"></span>',
      ].join(""),
      documentPath: "/repo/docs/report.mdx",
      root: "/repo",
      srcDir: "docs",
      imports: [defaultImport("Chart", "./Chart.ts")],
      components: { Badge: "./src/components/Badge.ts" },
      adapter,
      resolveClientModule: (module) => `/assets/${module.name}.js`,
      loadModule: async (moduleId) => {
        loaded.push(moduleId);
        return { default: moduleId.endsWith("Chart.ts") ? "chart-component" : "badge-component" };
      },
    });

    expect(loaded.sort()).toEqual(["/repo/docs/Chart.ts", "/repo/src/components/Badge.ts"]);
    expect(result.diagnostics).toEqual([]);
    expect(result.clientModules).toEqual([
      { name: "Chart", moduleId: "/assets/Chart.js", exportName: "default" },
      { name: "Badge", moduleId: "/assets/Badge.js", exportName: "default" },
    ]);
    expect(result.html).toContain('data-ox-module="/assets/Chart.js"');
    expect(result.html).toContain("data-ox-content='&lt;p&gt;slot&lt;/p&gt;'");
    expect(result.html).toContain(
      '<strong data-component="Chart">chart-component:Revenue:<p>slot</p></strong>',
    );
  });

  it("offers the standard renderer policy without framework-specific wiring", async () => {
    const renderer = createHtmlHostRenderer({
      root: "/repo",
      srcDir: "docs",
      adapter,
      loadModule: async () => ({}),
    });

    await expect(
      renderer('<div data-ox-island="Missing"></div>', {
        documentPath: "/repo/docs/report.mdx",
        components: { Missing: "./src/Missing.ts" },
      }),
    ).rejects.toMatchObject({
      name: "HtmlHostRenderError",
      diagnostics: [expect.objectContaining({ code: "missing-export", component: "Missing" })],
    });

    const error = new HtmlHostRenderError([
      {
        code: "missing-component",
        message: "missing",
        documentPath: "/repo/docs/report.mdx",
      },
    ]);
    expect(error.message).toContain("missing-component");
  });

  it("collects island head contributions once in document order", async () => {
    const result = await renderHtmlHost({
      html: '<div data-ox-island="First"></div><div data-ox-island="Second"></div>',
      documentPath: "/repo/docs/report.mdx",
      root: "/repo",
      components: {
        First: "./src/First.ts",
        Second: "./src/Second.ts",
      },
      loadModule: async (moduleId) => ({
        default: moduleId.endsWith("First.ts") ? "first" : "second",
      }),
      renderComponent: (component) => ({
        html: `<strong>${String(component)}</strong>`,
        head: [
          '<style data-svelte-h="shared">.probe{color:red}</style>',
          `<meta name="${String(component)}" content="ready">`,
        ].join(""),
      }),
    });

    expect(result.headContributions).toEqual([
      {
        component: "First",
        moduleId: "/repo/src/First.ts",
        html: '<style data-svelte-h="shared">.probe{color:red}</style>',
      },
      {
        component: "First",
        moduleId: "/repo/src/First.ts",
        html: '<meta name="first" content="ready">',
      },
      {
        component: "Second",
        moduleId: "/repo/src/Second.ts",
        html: '<meta name="second" content="ready">',
      },
    ]);
    expect(result.headHtml).toBe(
      [
        '<style data-svelte-h="shared">.probe{color:red}</style>',
        '<meta name="first" content="ready">',
        '<meta name="second" content="ready">',
      ].join("\n"),
    );
  });

  it("integrates Markdown render contexts with island metadata and document assets", async () => {
    const result = await renderHtmlHostMarkdown({
      context: {
        html: '<div data-ox-island="Chart"></div>',
        transform: { imports: [defaultImport("Chart", "./Chart.ts")] },
        source: "",
        documentPath: "/repo/docs/report.mdx",
        root: "/repo",
        srcDir: "/repo/docs",
        contentRoot: "/repo/docs",
        base: "/docs/",
        mode: "build",
        loadModule: async () => ({}),
        assets: {
          stylesheets: ({ modules }: { modules: readonly string[] }) => ({
            stylesheets: modules.map((moduleId) => ({
              kind: "style" as const,
              href: `/docs/assets/${moduleId.split("/").pop()}.css`,
              moduleId,
            })),
            diagnostics: [],
            dependencies: ["/repo/src/Chart.css"],
          }),
          document: (input: RenderDocumentAssetsInput = {}) => {
            const islandStyles = input.islandStyles ?? [];
            return {
              links: [],
              styles: [],
              scripts: [],
              tags: [],
              headHtml: [
                typeof input.head === "string" ? input.head : input.head?.html,
                ...islandStyles.map((style) =>
                  typeof style === "string" ? style : (style.href ?? style.content),
                ),
              ]
                .filter(Boolean)
                .join("\n"),
            };
          },
        },
      } as never,
      renderIslands: async () => ({
        html: '<div data-ox-island="Chart" data-ox-module="/src/Chart.ts"></div>',
        headHtml: '<meta name="chart" content="ready">',
        headContributions: [],
        modules: [
          {
            name: "Chart",
            serverModuleId: "/repo/docs/Chart.ts",
            exportName: "default",
            source: "document",
            clientModuleId: "/src/Chart.ts",
          },
        ],
        clientModules: [{ name: "Chart", moduleId: "/src/Chart.ts", exportName: "default" }],
        diagnostics: [],
      }),
    });

    expect(result.html).toContain('data-ox-module="/src/Chart.ts"');
    expect(result.dependencies).toEqual(["/repo/src/Chart.css"]);
    expect(result.metadata?.clientModules).toEqual([
      { name: "Chart", moduleId: "/src/Chart.ts", exportName: "default" },
    ]);
    expect(result.metadata?.documentAssets?.headHtml).toContain(
      '<meta name="chart" content="ready">',
    );
    expect(result.metadata?.documentAssets?.headHtml).toContain("/docs/assets/Chart.ts.css");
  });

  it("resolves shared registry modules from explicit entries and document imports", async () => {
    const result = await resolveHtmlHostIslandRegistry(
      {
        oxContent: { srcDir: "docs" },
        components: { Shared: "./src/Shared.ts" },
        entries: [{ name: "Approved", moduleId: "./src/Approved.ts" }],
        documents: [
          {
            documentPath: "/repo/docs/report.mdx",
            html: '<div data-ox-island="Chart"></div><div data-ox-island="Shared"></div>',
            imports: [defaultImport("Chart", "./Chart.ts")],
          },
        ],
      },
      { root: "/repo", mode: "production", command: "build" },
    );

    expect(result.modules).toEqual([
      { name: "Chart", moduleId: "/docs/Chart.ts", exportName: "default" },
      { name: "Approved", moduleId: "/src/Approved.ts", exportName: "default" },
      { name: "Shared", moduleId: "/src/Shared.ts", exportName: "default" },
    ]);
  });

  it("hydrates from a caller-owned component registry using the same slot contract", () => {
    const element = {
      dataset: { oxIsland: "Badge", oxContent: "<span>SSR</span>" },
      innerHTML: "<span>SSR</span>",
    } as unknown as HTMLElement;
    const calls: unknown[] = [];
    const hydrate = createHtmlHostHydrate({
      components: { Badge: "badge-component" },
      render: (component, props, target, slotHtml) => {
        calls.push({ component, props, target, slotHtml });
        return () => calls.push("disposed");
      },
    });

    const dispose = hydrate(element, { label: "ok" });

    expect(calls).toEqual([
      {
        component: "badge-component",
        props: { label: "ok" },
        target: element,
        slotHtml: "<span>SSR</span>",
      },
    ]);
    expect(element.innerHTML).toBe("");
    dispose?.();
    expect(calls.at(-1)).toBe("disposed");
  });
});

function defaultImport(local: string, source: string): MdxImport {
  return {
    source,
    specifiers: [{ imported: "default", local, kind: "default" }],
  };
}
