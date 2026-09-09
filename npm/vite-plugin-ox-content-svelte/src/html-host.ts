import {
  createHtmlHostHydrate,
  renderHtmlHost,
  type CreateHtmlHostHydrateInput,
  type HtmlHostClientModule,
  type HtmlHostComponentRenderer,
  type HtmlHostDiagnostic,
  type HtmlHostDiagnosticCode,
  type HtmlHostHydrateRenderer,
  type HtmlHostModule,
  type HtmlHostServerModuleLoader,
  type RenderHtmlHostInput,
} from "@ox-content/vite-plugin";
import { defaultRenderSvelteHtmlComponent } from "./html-host-default-renderer";
import type { ComponentsMap } from "./types";

export interface SvelteHtmlHostModule extends HtmlHostModule {}
export interface SvelteHtmlHostClientModule extends HtmlHostClientModule {}
export type SvelteHtmlHostDiagnosticCode = HtmlHostDiagnosticCode;
export interface SvelteHtmlHostDiagnostic extends HtmlHostDiagnostic {}
export type SvelteServerModuleLoader = HtmlHostServerModuleLoader;
export type SvelteHtmlComponentRenderer = HtmlHostComponentRenderer;
export type SvelteClientModuleResolver = (
  module: SvelteHtmlHostModule,
  context: { documentPath: string },
) => string | undefined;

export interface RenderSvelteHtmlHostInput extends Omit<
  RenderHtmlHostInput,
  "components" | "frameworkName" | "adapter" | "renderComponent" | "resolveClientModule"
> {
  components?: ComponentsMap;
  renderComponent?: SvelteHtmlComponentRenderer;
  resolveClientModule?: SvelteClientModuleResolver;
}

export interface RenderSvelteHtmlHostResult {
  html: string;
  modules: SvelteHtmlHostModule[];
  clientModules: SvelteHtmlHostClientModule[];
  diagnostics: SvelteHtmlHostDiagnostic[];
}

export type SvelteHostHydrateRenderer = HtmlHostHydrateRenderer;
export type CreateSvelteHtmlHostHydrateInput = CreateHtmlHostHydrateInput;

export async function renderSvelteHtmlHost(
  input: RenderSvelteHtmlHostInput,
): Promise<RenderSvelteHtmlHostResult> {
  const resolveClientModule: RenderHtmlHostInput["resolveClientModule"] = input.resolveClientModule;
  return (await renderHtmlHost({
    ...input,
    frameworkName: "Svelte",
    renderComponent: input.renderComponent ?? defaultRenderSvelteHtmlComponent,
    resolveClientModule,
  })) as RenderSvelteHtmlHostResult;
}

export function createSvelteHtmlHostHydrate(
  input: CreateSvelteHtmlHostHydrateInput,
): (element: HTMLElement, props: Record<string, unknown>) => void | (() => void) {
  return createHtmlHostHydrate(input);
}
