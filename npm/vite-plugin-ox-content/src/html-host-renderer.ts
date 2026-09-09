import {
  renderHtmlHost,
  type HtmlHostClientModuleResolver,
  type HtmlHostComponentRenderer,
  type HtmlHostDiagnostic,
  type HtmlHostFrameworkAdapter,
  type HtmlHostServerModuleLoader,
  type RenderHtmlHostResult,
} from "./html-host";
import { toHtmlHostClientModuleId } from "./html-host-registry-paths";
import type { HtmlHostComponentsMap } from "./html-host-components";
import type { MdxImport } from "./types";

export type HtmlHostRendererDiagnosticPolicy = "throw" | "collect";

export interface CreateHtmlHostRendererInput {
  root?: string;
  srcDir?: string;
  contentRoot?: string;
  components?: HtmlHostComponentsMap;
  loadModule: HtmlHostServerModuleLoader;
  adapter?: HtmlHostFrameworkAdapter;
  frameworkName?: string;
  renderComponent?: HtmlHostComponentRenderer;
  resolveClientModule?: HtmlHostClientModuleResolver;
  diagnostics?: HtmlHostRendererDiagnosticPolicy;
}

export interface HtmlHostRendererContext {
  documentPath: string;
  imports?: readonly MdxImport[];
  root?: string;
  srcDir?: string;
  contentRoot?: string;
  components?: HtmlHostComponentsMap;
  adapter?: HtmlHostFrameworkAdapter;
  frameworkName?: string;
  renderComponent?: HtmlHostComponentRenderer;
  resolveClientModule?: HtmlHostClientModuleResolver;
}

export type HtmlHostRenderer = (
  html: string,
  context: HtmlHostRendererContext,
) => Promise<RenderHtmlHostResult>;

export class HtmlHostRenderError extends Error {
  readonly diagnostics: HtmlHostDiagnostic[];

  constructor(diagnostics: readonly HtmlHostDiagnostic[]) {
    super(formatHtmlHostDiagnostics(diagnostics));
    this.name = "HtmlHostRenderError";
    this.diagnostics = [...diagnostics];
  }
}

export function createHtmlHostRenderer(input: CreateHtmlHostRendererInput): HtmlHostRenderer {
  const policy = input.diagnostics ?? "throw";

  return async (html, context) => {
    const root = context.root ?? input.root;
    const result = await renderHtmlHost({
      html,
      documentPath: context.documentPath,
      root,
      srcDir: context.srcDir ?? input.srcDir,
      contentRoot: context.contentRoot ?? input.contentRoot,
      imports: context.imports,
      components: context.components ?? input.components,
      loadModule: input.loadModule,
      adapter: context.adapter ?? input.adapter,
      frameworkName: context.frameworkName ?? input.frameworkName,
      renderComponent: context.renderComponent ?? input.renderComponent,
      resolveClientModule:
        context.resolveClientModule ??
        input.resolveClientModule ??
        ((module) => toHtmlHostClientModuleId(module.serverModuleId, root)),
    });

    if (policy === "throw" && result.diagnostics.length > 0) {
      throw new HtmlHostRenderError(result.diagnostics);
    }

    return result;
  };
}

export function formatHtmlHostDiagnostics(diagnostics: readonly HtmlHostDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "HTML host rendering failed.";
  }
  return diagnostics
    .map((diagnostic) => {
      const details = [
        diagnostic.documentPath,
        diagnostic.component && `component ${diagnostic.component}`,
        diagnostic.moduleId && `module ${diagnostic.moduleId}`,
      ].filter(Boolean);
      return `${diagnostic.code}: ${diagnostic.message}${
        details.length > 0 ? ` (${details.join(", ")})` : ""
      }`;
    })
    .join("\n");
}
