import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import packageJson from "../package.json" with { type: "json" };
import { createHtmlHostLazyHydrate, type HtmlHostClientError } from "./html-host";
import { initIslands } from "./runtime";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const require = createRequire(import.meta.url);

describe("HTML host island client contract", () => {
  it("declares a standalone browser subpath and pack entry", () => {
    const exportsField = packageJson.exports as unknown as Record<string, PackageExport>;
    const htmlHost = exportsField["./html-host"];

    expect(htmlHost.import.types).toBe("./dist/html-host.d.mts");
    expect(htmlHost.import.default).toBe("./dist/html-host.mjs");
    expect(htmlHost.require.types).toBe("./dist/html-host.d.cts");
    expect(htmlHost.require.default).toBe("./dist/html-host.cjs");

    const viteConfig = require(join(packageRoot, "vite.config.ts")) as {
      default: { pack: { entry: string[] } };
    };
    expect(viteConfig.default.pack.entry).toContain("src/html-host.ts");
  });

  it("marks islands hydrated only after async module loading and rendering succeed", async () => {
    const island = element({ oxIsland: "Chart", oxModule: "./Chart.js" });
    const pending = deferred<Record<string, unknown>>();
    const events: string[] = [];

    await withDocument([island], async () => {
      const controller = initIslands(
        createHtmlHostLazyHydrate({
          modules: { "./Chart.js": () => pending.promise },
          render: async ({ component }) => {
            events.push(`render:${String(component)}`);
            return () => events.push("dispose");
          },
        }),
        {
          onHydrateStart: () => events.push("start"),
          onHydrateEnd: () => events.push("end"),
        },
      );

      expect(island.dataset.oxHydrated).toBeUndefined();
      expect(island.classList.contains("ox-island-loading")).toBe(true);
      pending.resolve({ default: "chart" });
      await settle();

      expect(island.dataset.oxHydrated).toBe("true");
      expect(island.classList.contains("ox-island-loading")).toBe(false);
      expect(events).toEqual(["start", "render:chart", "end"]);

      controller.destroy();
      expect(events).toEqual(["start", "render:chart", "end", "dispose"]);
    });
  });

  it("reports async module failures without completing hydration", async () => {
    const island = element({ oxIsland: "Broken", oxModule: "./Broken.js" });
    const clientErrors: HtmlHostClientError[] = [];
    const hydrateErrors: Error[] = [];

    await withDocument([island], async () => {
      initIslands(
        createHtmlHostLazyHydrate({
          modules: { "./Broken.js": () => Promise.reject(new Error("network gone")) },
          render: () => {},
          onError: (error) => clientErrors.push(error),
        }),
        {
          onHydrateError: (_element, _config, error) => hydrateErrors.push(error),
        },
      );

      await settle();

      expect(island.dataset.oxHydrated).toBeUndefined();
      expect(island.classList.contains("ox-island-error")).toBe(true);
      expect(clientErrors).toEqual([
        expect.objectContaining({ code: "module-load-failed", moduleId: "./Broken.js" }),
      ]);
      expect(hydrateErrors[0]?.message).toContain("network gone");
    });
  });

  it("cancels pending lazy handles when the island controller is destroyed", async () => {
    const island = element({ oxIsland: "Chart", oxModule: "./Chart.js" });
    const pending = deferred<Record<string, unknown>>();
    const events: string[] = [];

    await withDocument([island], async () => {
      const controller = initIslands(
        createHtmlHostLazyHydrate({
          modules: { "./Chart.js": () => pending.promise },
          render: () => {
            events.push("render");
          },
        }),
      );

      controller.destroy();
      pending.resolve({ default: "chart" });
      await settle();

      expect(events).toEqual([]);
      expect(island.dataset.oxHydrated).toBeUndefined();
    });
  });
});

interface PackageExport {
  import: string;
  types: string;
}

function element(
  dataset: Record<string, string> = {},
  innerHTML = "",
): HTMLElement & { events: unknown[] } {
  const classes = new Set<string>();
  const events: unknown[] = [];
  return {
    dataset: { ...dataset },
    innerHTML,
    classList: {
      add: (...names: string[]) => names.forEach((name) => classes.add(name)),
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      contains: (name: string) => classes.has(name),
    },
    dispatchEvent(event: Event) {
      events.push(event);
      return true;
    },
    events,
  } as HTMLElement & { events: unknown[] };
}

async function withDocument(elements: HTMLElement[], run: () => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelectorAll: () => elements,
    },
  });
  try {
    await run();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "document", previous);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}
