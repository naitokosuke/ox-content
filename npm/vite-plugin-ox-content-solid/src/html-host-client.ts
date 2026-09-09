import {
  createHtmlHostLazyHydrate,
  readHtmlHostSlot,
  type HtmlHostLazyHydrateFunction,
} from "@ox-content/islands/html-host";
import type {
  CreateSolidHtmlHostLazyHydrateInput,
  InitSolidHtmlHostInput,
  SolidHtmlHostClientRenderer,
  SolidHtmlHostClientRuntimeLoader,
} from "./html-host-client-types";
import {
  createSolidHtmlHostDomRenderer,
  loadSolidHtmlHostDomRuntime,
  solidHtmlHostDomRendererMode,
} from "./html-host-dom-renderer";

export type {
  CreateSolidHtmlHostLazyHydrateInput,
  InitSolidHtmlHostInput,
  SolidHtmlHostClientContext,
  SolidHtmlHostClientDiagnosticCode,
  SolidHtmlHostClientError,
  SolidHtmlHostClientComponentValue,
  SolidHtmlHostClientModuleLoader,
  SolidHtmlHostClientModules,
  SolidHtmlHostClientModuleValue,
  SolidHtmlHostClientRenderer,
  SolidHtmlHostClientRuntimeLoader,
  SolidHtmlHostDomMode,
  SolidHtmlHostDomRendererInput,
  SolidHtmlHostDomRuntime,
  SolidHtmlHostExportNameResolver,
  SolidHtmlHostHydrationHandle,
  SolidHtmlHostInitIslands,
  SolidHtmlHostModuleIdResolver,
} from "./html-host-client-types";
export {
  createSolidHtmlHostDomRenderer,
  loadSolidHtmlHostDomRuntime,
  type SolidHtmlHostDomRenderer,
} from "./html-host-dom-renderer";

export function initSolidHtmlHost<TRuntime = undefined>(
  input: InitSolidHtmlHostInput<TRuntime>,
): ReturnType<InitSolidHtmlHostInput<TRuntime>["initIslands"]> {
  return input.initIslands(createSolidHtmlHostLazyHydrate(input), input.options);
}

export function createSolidHtmlHostLazyHydrate<TRuntime = undefined>(
  input: CreateSolidHtmlHostLazyHydrateInput<TRuntime>,
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
    frameworkName: "Solid",
    eventName: "ox-content-solid-html-host:error",
  });
}

export function readSolidHtmlHostSlot(
  element: Pick<HTMLElement, "dataset" | "innerHTML">,
): string | undefined {
  return readHtmlHostSlot(element);
}

function resolveRenderer<TRuntime>(
  input: CreateSolidHtmlHostLazyHydrateInput<TRuntime>,
): SolidHtmlHostClientRenderer<TRuntime> {
  if (input.render) return input.render;
  if (input.mount) {
    return createSolidHtmlHostDomRenderer(input.mount) as SolidHtmlHostClientRenderer<TRuntime>;
  }
  throw new Error("initSolidHtmlHost requires either render or mount.");
}

function resolveRuntimeLoader<TRuntime>(
  input: CreateSolidHtmlHostLazyHydrateInput<TRuntime>,
  render: SolidHtmlHostClientRenderer<TRuntime>,
): SolidHtmlHostClientRuntimeLoader<TRuntime> | undefined {
  if (input.loadRuntime) {
    return input.loadRuntime as SolidHtmlHostClientRuntimeLoader<TRuntime>;
  }
  if (input.mount || solidHtmlHostDomRendererMode(render as SolidHtmlHostClientRenderer<unknown>)) {
    return loadSolidHtmlHostDomRuntime as SolidHtmlHostClientRuntimeLoader<TRuntime>;
  }
  return undefined;
}

function preservesElementContents<TRuntime>(
  input: CreateSolidHtmlHostLazyHydrateInput<TRuntime>,
  render: SolidHtmlHostClientRenderer<TRuntime>,
): boolean {
  const mode =
    input.mount?.mode ??
    solidHtmlHostDomRendererMode(render as unknown as SolidHtmlHostClientRenderer<unknown>);
  return mode === "hydrate";
}
