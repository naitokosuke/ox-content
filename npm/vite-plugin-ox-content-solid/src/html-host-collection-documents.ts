import {
  resolveHtmlHostCollectionDocuments,
  type HtmlHostCollectionDocument,
  type HtmlHostCollectionDocumentsOptions,
  type HtmlHostIslandRegistryContext,
} from "@ox-content/vite-plugin";

export type SolidHtmlHostCollectionDocument = HtmlHostCollectionDocument;
export type SolidHtmlHostCollectionDocumentsOptions = HtmlHostCollectionDocumentsOptions;

export function createSolidHtmlHostCollectionDocuments(
  input: SolidHtmlHostCollectionDocumentsOptions = {},
): (context: HtmlHostIslandRegistryContext) => Promise<readonly SolidHtmlHostCollectionDocument[]> {
  return (context) => resolveSolidHtmlHostCollectionDocuments(input, context);
}

export function resolveSolidHtmlHostCollectionDocuments(
  input: SolidHtmlHostCollectionDocumentsOptions,
  context: HtmlHostIslandRegistryContext,
): Promise<readonly SolidHtmlHostCollectionDocument[]> {
  return resolveHtmlHostCollectionDocuments(input, context);
}
