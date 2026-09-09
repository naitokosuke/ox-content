import {
  createHtmlHostLazyHydrate,
  readHtmlHostSlot,
  type HtmlHostLazyHydrateFunction,
} from "@ox-content/islands/html-host";
import type {
  CreateSvelteHtmlHostLazyHydrateInput,
  InitSvelteHtmlHostInput,
  SvelteHtmlHostClientRenderer,
  SvelteHtmlHostClientRuntimeLoader,
} from "./html-host-client-types";
import {
  createSvelteHtmlHostDomRenderer,
  loadSvelteHtmlHostDomRuntime,
  svelteHtmlHostDomRendererMode,
} from "./html-host-dom-renderer";

export type {
  CreateSvelteHtmlHostLazyHydrateInput,
  InitSvelteHtmlHostInput,
  SvelteHtmlHostClientContext,
  SvelteHtmlHostClientDiagnosticCode,
  SvelteHtmlHostClientError,
  SvelteHtmlHostClientComponentValue,
  SvelteHtmlHostClientModuleLoader,
  SvelteHtmlHostClientModules,
  SvelteHtmlHostClientModuleValue,
  SvelteHtmlHostClientRenderer,
  SvelteHtmlHostClientRuntimeLoader,
  SvelteHtmlHostDomMode,
  SvelteHtmlHostDomRendererInput,
  SvelteHtmlHostDomRuntime,
  SvelteHtmlHostExportNameResolver,
  SvelteHtmlHostHydrationHandle,
  SvelteHtmlHostInitIslands,
  SvelteHtmlHostModuleIdResolver,
} from "./html-host-client-types";
export {
  createSvelteHtmlHostDomRenderer,
  loadSvelteHtmlHostDomRuntime,
  type SvelteHtmlHostDomRenderer,
} from "./html-host-dom-renderer";

export function initSvelteHtmlHost<TRuntime = undefined>(
  input: InitSvelteHtmlHostInput<TRuntime>,
): ReturnType<InitSvelteHtmlHostInput<TRuntime>["initIslands"]> {
  return input.initIslands(createSvelteHtmlHostLazyHydrate(input), input.options);
}

export function createSvelteHtmlHostLazyHydrate<TRuntime = undefined>(
  input: CreateSvelteHtmlHostLazyHydrateInput<TRuntime>,
): HtmlHostLazyHydrateFunction {
  const render = resolveRenderer(input);
  return createHtmlHostLazyHydrate({
    modules: input.modules,
    loadRuntime: resolveRuntimeLoader(input, render),
    resolveModuleId: input.resolveModuleId,
    resolveExportName: input.resolveExportName,
    onError: input.onError,
    render,
    preserveElementContents: preservesElementContents(input, render),
    frameworkName: "Svelte",
    eventName: "ox-content-svelte-html-host:error",
  });
}

export function readSvelteHtmlHostSlot(
  element: Pick<HTMLElement, "dataset" | "innerHTML">,
): string | undefined {
  return readHtmlHostSlot(element);
}

function resolveRenderer<TRuntime>(
  input: CreateSvelteHtmlHostLazyHydrateInput<TRuntime>,
): SvelteHtmlHostClientRenderer<TRuntime> {
  if (input.render) return input.render;
  if (input.mount) {
    return createSvelteHtmlHostDomRenderer(input.mount) as SvelteHtmlHostClientRenderer<TRuntime>;
  }
  throw new Error("initSvelteHtmlHost requires either render or mount.");
}

function resolveRuntimeLoader<TRuntime>(
  input: CreateSvelteHtmlHostLazyHydrateInput<TRuntime>,
  render: SvelteHtmlHostClientRenderer<TRuntime>,
): SvelteHtmlHostClientRuntimeLoader<TRuntime> | undefined {
  if (input.loadRuntime) {
    return input.loadRuntime as SvelteHtmlHostClientRuntimeLoader<TRuntime>;
  }
  if (
    input.mount ||
    svelteHtmlHostDomRendererMode(render as SvelteHtmlHostClientRenderer<unknown>)
  ) {
    return loadSvelteHtmlHostDomRuntime as SvelteHtmlHostClientRuntimeLoader<TRuntime>;
  }
  return undefined;
}

function preservesElementContents<TRuntime>(
  input: CreateSvelteHtmlHostLazyHydrateInput<TRuntime>,
  render: SvelteHtmlHostClientRenderer<TRuntime>,
): boolean {
  const mode =
    input.mount?.mode ??
    svelteHtmlHostDomRendererMode(render as unknown as SvelteHtmlHostClientRenderer<unknown>);
  return mode === "hydrate";
}
