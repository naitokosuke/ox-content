import {
  createHtmlHostIslandRegistry,
  resolveHtmlHostIslandRegistry,
  toHtmlHostClientModuleId,
  type CreateHtmlHostIslandRegistryInput,
  type HtmlHostIslandDocument,
  type HtmlHostIslandEntry,
  type HtmlHostIslandRegistry,
  type HtmlHostIslandRegistryContext,
  type ResolvedHtmlHostIslandRegistry,
} from "@ox-content/vite-plugin";

export { toHtmlHostClientModuleId as toSvelteHtmlHostClientModuleId };

export const SVELTE_HTML_HOST_MODULES_VIRTUAL_ID = "virtual:ox-content-svelte/html-host/modules";

export type SvelteHtmlHostIslandDocument = HtmlHostIslandDocument;
export type SvelteHtmlHostIslandEntry = HtmlHostIslandEntry;
export type SvelteHtmlHostIslandRegistryContext = HtmlHostIslandRegistryContext;
export type CreateSvelteHtmlHostIslandRegistryInput = CreateHtmlHostIslandRegistryInput;
export type ResolvedSvelteHtmlHostIslandRegistry = ResolvedHtmlHostIslandRegistry;
export type SvelteHtmlHostIslandRegistry = HtmlHostIslandRegistry;

export function createSvelteHtmlHostIslandRegistry(
  input: CreateSvelteHtmlHostIslandRegistryInput = {},
): SvelteHtmlHostIslandRegistry {
  return createHtmlHostIslandRegistry({
    ...input,
    virtualModuleId: input.virtualModuleId ?? SVELTE_HTML_HOST_MODULES_VIRTUAL_ID,
    pluginName: input.pluginName ?? "ox-content:svelte-html-host-island-registry",
  });
}

export function resolveSvelteHtmlHostIslandRegistry(
  input: CreateSvelteHtmlHostIslandRegistryInput,
  context: SvelteHtmlHostIslandRegistryContext,
  resolvedComponents?: Record<string, string>,
): Promise<ResolvedSvelteHtmlHostIslandRegistry> {
  return resolveHtmlHostIslandRegistry(input, context, resolvedComponents);
}
