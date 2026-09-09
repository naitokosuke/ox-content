import {
  resolveHtmlHostCollectionDocuments,
  type HtmlHostCollectionDocument,
  type HtmlHostCollectionDocumentsOptions,
  type HtmlHostIslandRegistryContext,
} from "@ox-content/vite-plugin";

export type SvelteHtmlHostCollectionDocument = HtmlHostCollectionDocument;
export type SvelteHtmlHostCollectionDocumentsOptions = HtmlHostCollectionDocumentsOptions;

export function createSvelteHtmlHostCollectionDocuments(
  input: SvelteHtmlHostCollectionDocumentsOptions = {},
): (
  context: HtmlHostIslandRegistryContext,
) => Promise<readonly SvelteHtmlHostCollectionDocument[]> {
  return (context) => resolveSvelteHtmlHostCollectionDocuments(input, context);
}

export function resolveSvelteHtmlHostCollectionDocuments(
  input: SvelteHtmlHostCollectionDocumentsOptions,
  context: HtmlHostIslandRegistryContext,
): Promise<readonly SvelteHtmlHostCollectionDocument[]> {
  return resolveHtmlHostCollectionDocuments(input, context);
}
