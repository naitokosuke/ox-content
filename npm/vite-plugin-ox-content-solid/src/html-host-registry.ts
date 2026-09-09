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

export { toHtmlHostClientModuleId as toSolidHtmlHostClientModuleId };

export const SOLID_HTML_HOST_MODULES_VIRTUAL_ID = "virtual:ox-content-solid/html-host/modules";

export type SolidHtmlHostIslandDocument = HtmlHostIslandDocument;
export type SolidHtmlHostIslandEntry = HtmlHostIslandEntry;
export type SolidHtmlHostIslandRegistryContext = HtmlHostIslandRegistryContext;
export type CreateSolidHtmlHostIslandRegistryInput = CreateHtmlHostIslandRegistryInput;
export type ResolvedSolidHtmlHostIslandRegistry = ResolvedHtmlHostIslandRegistry;
export type SolidHtmlHostIslandRegistry = HtmlHostIslandRegistry;

export function createSolidHtmlHostIslandRegistry(
  input: CreateSolidHtmlHostIslandRegistryInput = {},
): SolidHtmlHostIslandRegistry {
  return createHtmlHostIslandRegistry({
    ...input,
    virtualModuleId: input.virtualModuleId ?? SOLID_HTML_HOST_MODULES_VIRTUAL_ID,
    pluginName: input.pluginName ?? "ox-content:solid-html-host-island-registry",
  });
}

export function resolveSolidHtmlHostIslandRegistry(
  input: CreateSolidHtmlHostIslandRegistryInput,
  context: SolidHtmlHostIslandRegistryContext,
  resolvedComponents?: Record<string, string>,
): Promise<ResolvedSolidHtmlHostIslandRegistry> {
  return resolveHtmlHostIslandRegistry(input, context, resolvedComponents);
}
