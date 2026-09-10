import type {
  OxContentCustomHostDependency,
  OxContentCustomHostMarkdownRenderContext,
  OxContentCustomHostMarkdownRenderResult,
  OxContentCustomHostStylesheet,
  OxContentCustomHostStylesheetDiagnostic,
} from "./custom-host";
import type { RenderDocumentAssetsInput, RenderDocumentAssetsResult } from "./document-assets";
import type { HtmlHostComponentsMap } from "./html-host-components";
import type {
  HtmlHostClientModule,
  HtmlHostDiagnostic,
  HtmlHostModule,
  RenderHtmlHostResult,
} from "./html-host";
import type { HtmlHostRenderer } from "./html-host-renderer";

export type HtmlHostVirtualClientModules = Readonly<Record<string, () => Promise<unknown>>>;

export interface RenderHtmlHostMarkdownInput {
  context: OxContentCustomHostMarkdownRenderContext;
  renderIslands: HtmlHostRenderer;
  components?: HtmlHostComponentsMap;
  documentAssets?: RenderDocumentAssetsInput | false;
}

export interface HtmlHostMarkdownMetadata {
  modules: HtmlHostModule[];
  clientModules: HtmlHostClientModule[];
  diagnostics: HtmlHostDiagnostic[];
  headHtml: string;
  islandStyles: OxContentCustomHostStylesheet[];
  islandStyleDiagnostics: OxContentCustomHostStylesheetDiagnostic[];
  documentAssets?: RenderDocumentAssetsResult;
}

export async function renderHtmlHostMarkdown(
  input: RenderHtmlHostMarkdownInput,
): Promise<OxContentCustomHostMarkdownRenderResult<HtmlHostMarkdownMetadata>> {
  const context = input.context;
  const rendered = await input.renderIslands(context.html, {
    documentPath: context.documentPath,
    imports: context.transform.imports,
    root: context.root,
    srcDir: context.srcDir,
    contentRoot: context.contentRoot,
    components: input.components,
  });
  const islandStyles = context.assets.stylesheets({
    modules: rendered.clientModules.map((module) => module.moduleId),
  });
  const documentAssets =
    input.documentAssets === false
      ? undefined
      : context.assets.document({
          ...input.documentAssets,
          head: joinHead(input.documentAssets?.head, rendered.headHtml),
          islandStyles: [
            ...(input.documentAssets?.islandStyles ?? []),
            ...islandStyles.stylesheets,
          ],
        });

  return {
    html: rendered.html,
    metadata: {
      ...htmlHostMetadata(rendered),
      islandStyles: islandStyles.stylesheets,
      islandStyleDiagnostics: islandStyles.diagnostics,
      documentAssets,
    },
    dependencies: islandStyles.dependencies.map(
      (dependency): OxContentCustomHostDependency => dependency,
    ),
  };
}

function htmlHostMetadata(result: RenderHtmlHostResult) {
  return {
    modules: result.modules,
    clientModules: result.clientModules,
    diagnostics: result.diagnostics,
    headHtml: result.headHtml,
  };
}

function joinHead(
  head: RenderDocumentAssetsInput["head"] | undefined,
  islandHead: string,
): RenderDocumentAssetsInput["head"] {
  const parts = [headHtml(head), islandHead.trim()].filter(Boolean);
  return parts.join("\n");
}

function headHtml(head: RenderDocumentAssetsInput["head"] | undefined): string {
  if (!head) return "";
  if (typeof head === "string") return head.trim();
  return head.html?.trim() ?? "";
}
