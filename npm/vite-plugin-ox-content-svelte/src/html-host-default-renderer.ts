import type { HtmlHostComponentRenderResult } from "@ox-content/vite-plugin";
import type { SvelteHtmlComponentRenderer, SvelteServerModuleLoader } from "./html-host";

type SvelteServerRuntime = {
  render: (
    component: never,
    options: { props?: Record<string, unknown> },
  ) => { body?: string; head?: string; html?: string };
};

type SvelteSharedRuntime = {
  createRawSnippet: (
    factory: () => {
      render: () => string;
    },
  ) => unknown;
};

export const defaultRenderSvelteHtmlComponent: SvelteHtmlComponentRenderer = async (
  component,
  props,
  slotHtml,
) => {
  const runtime = await loadDefaultSvelteRuntime();
  return renderWithSvelteRuntime(runtime, component, props, slotHtml);
};

export function createSvelteHtmlHostComponentRenderer(
  loadModule: SvelteServerModuleLoader,
): SvelteHtmlComponentRenderer {
  let pending: Promise<ResolvedSvelteRuntime> | undefined;

  return async (component, props, slotHtml) => {
    pending ??= loadSvelteRuntimeFromHost(loadModule);
    return renderWithSvelteRuntime(await pending, component, props, slotHtml);
  };
}

type ResolvedSvelteRuntime = {
  render: SvelteServerRuntime["render"];
  createRawSnippet: SvelteSharedRuntime["createRawSnippet"];
};

async function loadDefaultSvelteRuntime(): Promise<ResolvedSvelteRuntime> {
  const [server, shared] = await Promise.all([import("svelte/server"), import("svelte")]);
  return resolveSvelteRuntime(server, shared);
}

async function loadSvelteRuntimeFromHost(
  loadModule: SvelteServerModuleLoader,
): Promise<ResolvedSvelteRuntime> {
  const [server, shared] = await Promise.all([loadModule("svelte/server"), loadModule("svelte")]);
  return resolveSvelteRuntime(server, shared);
}

function renderWithSvelteRuntime(
  runtime: ResolvedSvelteRuntime,
  component: unknown,
  props: Record<string, unknown>,
  slotHtml: string | undefined,
): HtmlHostComponentRenderResult {
  const componentProps = slotHtml
    ? { ...props, children: runtime.createRawSnippet(() => ({ render: () => slotHtml })) }
    : props;
  const rendered = runtime.render(component as never, { props: componentProps });
  return {
    html: rendered.html ?? rendered.body ?? "",
    head: rendered.head,
  };
}

function resolveSvelteRuntime(server: unknown, shared: unknown): ResolvedSvelteRuntime {
  return {
    render: runtimeFunction<SvelteServerRuntime["render"]>(server, "render", "svelte/server"),
    createRawSnippet: runtimeFunction<SvelteSharedRuntime["createRawSnippet"]>(
      shared,
      "createRawSnippet",
      "svelte",
    ),
  };
}

function runtimeFunction<T extends (...args: never[]) => unknown>(
  module: unknown,
  name: string,
  moduleId: string,
): T {
  const value =
    module && typeof module === "object" ? (module as Record<string, unknown>)[name] : undefined;
  if (typeof value !== "function") {
    throw new Error(`Svelte HTML host renderer could not load ${moduleId}.${name}.`);
  }
  return value as T;
}
