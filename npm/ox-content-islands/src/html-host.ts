import type { HydrateFunction, InitIslandsOptions } from "./types";
import {
  HtmlHostClientHydrationError,
  createHtmlHostClientError,
  once,
  reportHtmlHostClientError,
  type HtmlHostClientDiagnosticCode,
  type HtmlHostClientError,
} from "./html-host-errors";

const ISLAND_JSON_SCRIPT = /^\s*<script type="application\/json">[\s\S]*?<\/script>/;

export { HtmlHostClientHydrationError, createHtmlHostClientError, reportHtmlHostClientError };
export type { HtmlHostClientDiagnosticCode, HtmlHostClientError };

export type HtmlHostClientComponentValue = unknown;
export type HtmlHostClientModuleValue = unknown;

export type HtmlHostClientModuleLoader<TModule = HtmlHostClientModuleValue> = () =>
  | TModule
  | PromiseLike<TModule>;

export type HtmlHostClientModules<TModule = HtmlHostClientModuleValue> =
  | Readonly<Record<string, HtmlHostClientModuleLoader<TModule>>>
  | ReadonlyMap<string, HtmlHostClientModuleLoader<TModule>>;

export interface HtmlHostClientContext<TRuntime = undefined> {
  component: unknown;
  componentName: string;
  element: HTMLElement;
  exportName: string;
  moduleExports: unknown;
  moduleId: string;
  props: Record<string, unknown>;
  runtime: TRuntime | undefined;
  slotHtml: string | undefined;
}

export type HtmlHostClientRenderer<TRuntime = undefined> = (
  context: HtmlHostClientContext<TRuntime>,
) => void | (() => void) | PromiseLike<void | (() => void)>;

export type HtmlHostClientRuntimeLoader<TRuntime = undefined> = () =>
  | TRuntime
  | PromiseLike<TRuntime>;

export type HtmlHostModuleIdResolver = (
  element: HTMLElement,
  context: { componentName: string; props: Record<string, unknown> },
) => string | undefined;

export type HtmlHostExportNameResolver = (
  element: HTMLElement,
  context: { componentName: string; moduleId: string; props: Record<string, unknown> },
) => string | undefined;

export interface HtmlHostClientAdapter<TRuntime = undefined> {
  frameworkName?: string;
  eventName?: string;
  render: HtmlHostClientRenderer<TRuntime>;
  loadRuntime?: HtmlHostClientRuntimeLoader<TRuntime>;
  preserveElementContents?: boolean;
}

export interface CreateHtmlHostLazyHydrateInput<TRuntime = undefined> {
  modules: HtmlHostClientModules;
  adapter?: HtmlHostClientAdapter<TRuntime>;
  render?: HtmlHostClientRenderer<TRuntime>;
  loadRuntime?: HtmlHostClientRuntimeLoader<TRuntime>;
  preserveElementContents?: boolean;
  resolveModuleId?: HtmlHostModuleIdResolver;
  resolveExportName?: HtmlHostExportNameResolver;
  onError?: (error: HtmlHostClientError) => void;
  frameworkName?: string;
  eventName?: string;
}

export type HtmlHostHydrationHandle = (() => void) & PromiseLike<void>;

export type HtmlHostLazyHydrateFunction = (
  element: HTMLElement,
  props: Record<string, unknown>,
) => HtmlHostHydrationHandle;

export type HtmlHostInitIslands<TController = unknown> = (
  hydrate: HydrateFunction,
  options?: InitIslandsOptions,
) => TController;

export type InitHtmlHostInput<TRuntime = undefined> = CreateHtmlHostLazyHydrateInput<TRuntime> & {
  initIslands: HtmlHostInitIslands;
  options?: InitIslandsOptions;
};

export function initHtmlHost<TRuntime = undefined>(
  input: InitHtmlHostInput<TRuntime>,
): ReturnType<InitHtmlHostInput<TRuntime>["initIslands"]> {
  return input.initIslands(createHtmlHostLazyHydrate(input), input.options);
}

export function createHtmlHostLazyHydrate<TRuntime = undefined>(
  input: CreateHtmlHostLazyHydrateInput<TRuntime>,
): HtmlHostLazyHydrateFunction {
  const render = resolveRenderer(input);
  const loadRuntime = input.loadRuntime ?? input.adapter?.loadRuntime;
  const preserveElementContents =
    input.preserveElementContents ?? input.adapter?.preserveElementContents ?? false;
  const frameworkName = input.frameworkName ?? input.adapter?.frameworkName ?? "HTML host";
  const eventName = input.eventName ?? input.adapter?.eventName ?? "ox-content-html-host:error";
  const moduleCache = new Map<string, Promise<unknown>>();
  let runtimeCache: Promise<TRuntime> | undefined;

  return (element, props) => {
    let disposed = false;
    let disposeMounted: (() => void) | undefined;

    const dispose = (() => {
      if (disposed) return;
      disposed = true;
      disposeMounted?.();
      disposeMounted = undefined;
    }) as HtmlHostHydrationHandle;

    const ready = (async () => {
      const componentName = element.dataset.oxIsland;
      if (!componentName) {
        fail(input, eventName, frameworkName, "missing-island-name", element, props);
      }

      const moduleId =
        input.resolveModuleId?.(element, { componentName, props }) ?? element.dataset.oxModule;
      if (!moduleId) {
        fail(input, eventName, frameworkName, "missing-module-id", element, props, {
          componentName,
        });
      }
      if (!moduleLoader(input.modules, moduleId)) {
        fail(input, eventName, frameworkName, "unknown-module", element, props, {
          componentName,
          moduleId,
        });
      }

      const exportName =
        input.resolveExportName?.(element, { componentName, moduleId, props }) ??
        element.dataset.oxExport ??
        "default";
      const slotHtml = readHtmlHostSlot(element);

      let moduleExports: unknown;
      let runtime: TRuntime | undefined;
      try {
        moduleExports = await loadClientModule(input.modules, moduleId, moduleCache);
      } catch (cause) {
        if (!disposed) {
          fail(input, eventName, frameworkName, "module-load-failed", element, props, {
            componentName,
            moduleId,
            exportName,
            cause,
          });
        }
        return;
      }

      if (disposed) return;

      try {
        runtime = await loadHtmlHostRuntime(
          loadRuntime,
          () => runtimeCache,
          (pending) => {
            runtimeCache = pending;
          },
        );
      } catch (cause) {
        if (!disposed) {
          fail(input, eventName, frameworkName, "runtime-load-failed", element, props, {
            componentName,
            moduleId,
            exportName,
            cause,
          });
        }
        return;
      }

      if (disposed) return;

      const component = exportedValue(moduleExports, exportName);
      if (component == null) {
        fail(input, eventName, frameworkName, "missing-export", element, props, {
          componentName,
          moduleId,
          exportName,
          cause: new Error(`Export "${exportName}" was not found.`),
        });
      }

      if (!preserveElementContents) {
        element.innerHTML = "";
      }
      try {
        const cleanup = await render({
          component,
          componentName,
          element,
          exportName,
          moduleExports,
          moduleId,
          props,
          runtime,
          slotHtml,
        });
        disposeMounted = cleanup ? once(cleanup) : undefined;
        if (disposed) {
          disposeMounted?.();
          disposeMounted = undefined;
        }
      } catch (cause) {
        if (!disposed) {
          fail(input, eventName, frameworkName, "render-failed", element, props, {
            componentName,
            moduleId,
            exportName,
            cause,
          });
        }
      }
    })();

    ready.catch(() => undefined);
    // Promise-like handles let initIslands keep the loading state until async
    // module/runtime/render work has completed.
    // oxlint-disable-next-line unicorn/no-thenable
    Object.defineProperty(dispose, "then", { value: ready.then.bind(ready) });
    return dispose;
  };
}

export function readHtmlHostSlot(
  element: Pick<HTMLElement, "dataset" | "innerHTML">,
): string | undefined {
  const fromAttr = element.dataset.oxContent;
  if (fromAttr) return fromAttr;
  if (element.dataset.oxSsr === "true") return undefined;

  const slotHtml = element.innerHTML.replace(ISLAND_JSON_SCRIPT, "");
  return slotHtml || undefined;
}

async function loadClientModule(
  modules: HtmlHostClientModules,
  moduleId: string,
  cache: Map<string, Promise<unknown>>,
): Promise<unknown> {
  const cached = cache.get(moduleId);
  if (cached) return cached;

  const loader = moduleLoader(modules, moduleId);
  if (!loader) {
    throw new Error(`Unknown module "${moduleId}".`);
  }

  const pending = Promise.resolve()
    .then(loader)
    .catch((cause: unknown) => {
      cache.delete(moduleId);
      throw cause;
    });
  cache.set(moduleId, pending);
  return pending;
}

async function loadHtmlHostRuntime<TRuntime>(
  load: HtmlHostClientRuntimeLoader<TRuntime> | undefined,
  getCached: () => Promise<TRuntime> | undefined,
  setCached: (pending: Promise<TRuntime> | undefined) => void,
): Promise<TRuntime | undefined> {
  if (!load) return undefined;

  const cached = getCached();
  if (cached) return cached;

  const pending = Promise.resolve()
    .then(load)
    .catch((cause: unknown) => {
      setCached(undefined);
      throw cause;
    });
  setCached(pending);
  return pending;
}

function fail(
  input: Pick<CreateHtmlHostLazyHydrateInput, "onError">,
  eventName: string,
  frameworkName: string,
  code: HtmlHostClientDiagnosticCode,
  element: HTMLElement,
  props: Record<string, unknown>,
  context: {
    componentName?: string;
    moduleId?: string;
    exportName?: string;
    cause?: unknown;
  } = {},
): never {
  const error = createHtmlHostClientError(code, element, props, {
    ...context,
    frameworkName,
  });
  reportHtmlHostClientError(input, error, eventName);
  throw new HtmlHostClientHydrationError(error);
}

function resolveRenderer<TRuntime>(
  input: CreateHtmlHostLazyHydrateInput<TRuntime>,
): HtmlHostClientRenderer<TRuntime> {
  const render = input.render ?? input.adapter?.render;
  if (render) return render;
  throw new Error("initHtmlHost requires either render or adapter.render.");
}

function moduleLoader(
  modules: HtmlHostClientModules,
  moduleId: string,
): HtmlHostClientModuleLoader | undefined {
  return isReadonlyMap(modules) ? modules.get(moduleId) : modules[moduleId];
}

function isReadonlyMap(
  value: HtmlHostClientModules,
): value is ReadonlyMap<string, HtmlHostClientModuleLoader> {
  return typeof (value as ReadonlyMap<string, HtmlHostClientModuleLoader>).get === "function";
}

function exportedValue(moduleExports: unknown, exportName: string): unknown {
  if (exportName === "default" && typeof moduleExports === "function") {
    return moduleExports;
  }
  if (!moduleExports || typeof moduleExports !== "object") {
    return undefined;
  }
  return (moduleExports as Record<string, unknown>)[exportName];
}
