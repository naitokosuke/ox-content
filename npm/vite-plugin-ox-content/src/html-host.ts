import path from "node:path";
import { resolveContentRootPath, resolveDocumentComponentImports } from "./document-imports";
import type { DocumentImportDiagnostic } from "./document-imports";
import {
  dedupeHeadContributions,
  headContributionsFromRenderResult,
  normalizeRenderResult,
  type HtmlHostHeadResult,
} from "./html-host-head";
import { applyIslandSsrHtml } from "./island-ssr";
import { collectMdxIslandNamesFromHtml } from "./mdx-islands";
import type { MdxImport } from "./types";
import type { HtmlHostComponentsMap } from "./html-host-components";

export { createHtmlHostHydrate } from "./html-host-hydrate";
export type { CreateHtmlHostHydrateInput, HtmlHostHydrateRenderer } from "./html-host-hydrate";

export interface HtmlHostModule {
  name: string;
  serverModuleId: string;
  exportName: string;
  source: "document" | "components";
  clientModuleId?: string;
}

export interface HtmlHostClientModule {
  name: string;
  moduleId: string;
  exportName: string;
}

export type HtmlHostDiagnosticCode =
  | DocumentImportDiagnostic["code"]
  | "missing-component"
  | "module-load-failed"
  | "missing-export"
  | "ssr-failed";

export interface HtmlHostDiagnostic {
  code: HtmlHostDiagnosticCode;
  message: string;
  documentPath: string;
  component?: string;
  moduleId?: string;
}

export type HtmlHostServerModuleLoader = (moduleId: string) => Promise<unknown>;
type HtmlHostComponentValue = NonNullable<unknown>;

export interface HtmlHostComponentRenderContext {
  component: string;
  moduleId: string;
  documentPath: string;
}

export interface HtmlHostComponentRenderResult {
  html: string;
  head?: string;
}

export type HtmlHostComponentRenderOutput = string | HtmlHostComponentRenderResult;

export type HtmlHostComponentRenderer = (
  component: unknown,
  props: Record<string, unknown>,
  slotHtml: string | undefined,
  context: HtmlHostComponentRenderContext,
) => HtmlHostComponentRenderOutput | Promise<HtmlHostComponentRenderOutput>;

export interface HtmlHostFrameworkAdapter {
  frameworkName?: string;
  renderComponent: HtmlHostComponentRenderer;
}

export type HtmlHostClientModuleResolver = (
  module: HtmlHostModule,
  context: { documentPath: string },
) => string | undefined;

export interface RenderHtmlHostInput {
  html: string;
  documentPath: string;
  components?: HtmlHostComponentsMap;
  imports?: readonly MdxImport[];
  root?: string;
  srcDir?: string;
  contentRoot?: string;
  loadModule: HtmlHostServerModuleLoader;
  adapter?: HtmlHostFrameworkAdapter;
  frameworkName?: string;
  renderComponent?: HtmlHostComponentRenderer;
  resolveClientModule?: HtmlHostClientModuleResolver;
}

export interface RenderHtmlHostResult {
  html: string;
  headHtml: string;
  headContributions: HtmlHostHeadContribution[];
  modules: HtmlHostModule[];
  clientModules: HtmlHostClientModule[];
  diagnostics: HtmlHostDiagnostic[];
}

export interface HtmlHostHeadContribution {
  component: string;
  moduleId: string;
  html: string;
}

export async function renderHtmlHost(input: RenderHtmlHostInput): Promise<RenderHtmlHostResult> {
  const renderComponent = input.renderComponent ?? input.adapter?.renderComponent;
  if (!renderComponent) {
    throw new Error("renderHtmlHost requires either renderComponent or adapter.renderComponent.");
  }

  const frameworkName = input.frameworkName ?? input.adapter?.frameworkName ?? "HTML host";
  const diagnostics: HtmlHostDiagnostic[] = [];
  const modules = resolveHostModules(input, diagnostics, frameworkName);
  const byName = new Map(modules.map((module) => [module.name, module] as const));
  const cache = new Map<string, Promise<unknown>>();
  const headResults: HtmlHostHeadResult[] = [];
  let nextIslandOrder = 0;

  const html = await applyIslandSsrHtml(
    input.html,
    async (name, props, _filePath, slotHtml) => {
      const order = -nextIslandOrder;
      nextIslandOrder += 1;
      const module = byName.get(name);
      if (!module) {
        diagnostics.push({
          code: "missing-component",
          message: `${frameworkName} island "${name}" is not registered for this document.`,
          documentPath: input.documentPath,
          component: name,
        });
        return slotHtml ?? "";
      }
      const component = await loadComponent(input, module, cache, diagnostics, frameworkName);
      if (!component) {
        return slotHtml ?? "";
      }
      try {
        const rendered = await renderComponent(component, props, slotHtml || undefined, {
          component: name,
          moduleId: module.serverModuleId,
          documentPath: input.documentPath,
        });
        const result = normalizeRenderResult(rendered);
        const contributions = headContributionsFromRenderResult(result, {
          component: name,
          moduleId: module.serverModuleId,
        });
        if (contributions.length > 0) {
          headResults.push({ order, contributions });
        }
        return result.html;
      } catch (error) {
        diagnostics.push({
          code: "ssr-failed",
          message: `${frameworkName} island "${name}" failed to render: ${errorMessage(error)}`,
          documentPath: input.documentPath,
          component: name,
          moduleId: module.serverModuleId,
        });
        return slotHtml ?? "";
      }
    },
    input.documentPath,
    modules.map((module) => module.name),
  );
  const headContributions = dedupeHeadContributions(headResults);

  return {
    html: markClientModules(html, modules),
    headHtml: headContributions.map((contribution) => contribution.html).join("\n"),
    headContributions,
    modules,
    clientModules: modules.flatMap((module) =>
      module.clientModuleId
        ? [{ name: module.name, moduleId: module.clientModuleId, exportName: module.exportName }]
        : [],
    ),
    diagnostics,
  };
}

function resolveHostModules(
  input: RenderHtmlHostInput,
  diagnostics: HtmlHostDiagnostic[],
  frameworkName: string,
): HtmlHostModule[] {
  const names = collectMdxIslandNamesFromHtml(input.html);
  const local = resolveDocumentComponentImports({
    imports: input.imports ?? [],
    documentPath: input.documentPath,
    contentRoot: input.contentRoot ?? resolveContentRootPath(input),
    srcDir: input.srcDir,
  });
  for (const diagnostic of local.diagnostics) {
    diagnostics.push({ ...diagnostic, documentPath: input.documentPath });
  }

  const localBindings = new Map(local.bindings.map((binding) => [binding.localName, binding]));
  const modules: HtmlHostModule[] = [];
  for (const name of names) {
    const localBinding = localBindings.get(name);
    const serverModuleId = localBinding
      ? localBinding.resolvedPath
      : componentPath(input.components ?? {}, name, input.root);
    if (!serverModuleId) {
      diagnostics.push({
        code: "missing-component",
        message: `${frameworkName} island "${name}" is not registered for this document.`,
        documentPath: input.documentPath,
        component: name,
      });
      continue;
    }
    const module: HtmlHostModule = {
      name,
      serverModuleId,
      exportName: localBinding?.imported ?? "default",
      source: localBinding ? "document" : "components",
    };
    const clientModuleId = input.resolveClientModule?.(module, {
      documentPath: input.documentPath,
    });
    modules.push(clientModuleId ? { ...module, clientModuleId } : module);
  }
  return modules;
}

async function loadComponent(
  input: RenderHtmlHostInput,
  module: HtmlHostModule,
  cache: Map<string, Promise<unknown>>,
  diagnostics: HtmlHostDiagnostic[],
  frameworkName: string,
): Promise<HtmlHostComponentValue | undefined> {
  let pending = cache.get(module.serverModuleId);
  if (!pending) {
    pending = input.loadModule(module.serverModuleId);
    cache.set(module.serverModuleId, pending);
  }
  let exports: unknown;
  try {
    exports = await pending;
  } catch (error) {
    diagnostics.push({
      code: "module-load-failed",
      message: `${frameworkName} island module "${module.serverModuleId}" failed to load: ${errorMessage(error)}`,
      documentPath: input.documentPath,
      component: module.name,
      moduleId: module.serverModuleId,
    });
    return undefined;
  }
  const component = exportedValue(exports, module.exportName);
  if (!component) {
    diagnostics.push({
      code: "missing-export",
      message: `${frameworkName} island "${module.name}" could not find export "${module.exportName}".`,
      documentPath: input.documentPath,
      component: module.name,
      moduleId: module.serverModuleId,
    });
  }
  return component == null ? undefined : component;
}

function componentPath(
  components: HtmlHostComponentsMap,
  name: string,
  root = process.cwd(),
): string | undefined {
  const specifier = components[name];
  if (!specifier) {
    return undefined;
  }
  return path.resolve(root, specifier.replace(/^\.\//, ""));
}

function exportedValue(exports: unknown, exportName: string): unknown {
  if (!exports || typeof exports !== "object") {
    return undefined;
  }
  return (exports as Record<string, unknown>)[exportName];
}

function markClientModules(html: string, modules: readonly HtmlHostModule[]): string {
  const clientModules = new Map(
    modules.filter((module) => module.clientModuleId).map((module) => [module.name, module]),
  );
  if (clientModules.size === 0) return html;

  return html.replace(
    /<(div|span)\b([^>]*\bdata-ox-island="([^"]+)"[^>]*)>/gi,
    (openTag: string, _tag: string, _attrs: string, encodedName: string) => {
      const module = clientModules.get(decodeHtmlAttr(encodedName));
      if (!module?.clientModuleId) return openTag;

      const attrs: string[] = [];
      if (!hasAttr(openTag, "data-ox-module")) {
        attrs.push(`data-ox-module="${escapeDoubleQuotedAttr(module.clientModuleId)}"`);
      }
      if (!hasAttr(openTag, "data-ox-export")) {
        attrs.push(`data-ox-export="${escapeDoubleQuotedAttr(module.exportName)}"`);
      }
      return attrs.length === 0 ? openTag : openTag.replace(/>$/, ` ${attrs.join(" ")}>`);
    },
  );
}

function escapeDoubleQuotedAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeHtmlAttr(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function hasAttr(openTag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?:\\s*=|\\s|>|$)`, "i").test(openTag);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
