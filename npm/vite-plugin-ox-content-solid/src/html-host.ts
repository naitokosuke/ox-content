import {
  createHtmlHostHydrate,
  renderHtmlHost,
  type CreateHtmlHostHydrateInput,
  type HtmlHostClientModule,
  type HtmlHostComponentRenderer,
  type HtmlHostDiagnostic,
  type HtmlHostDiagnosticCode,
  type HtmlHostHeadContribution,
  type HtmlHostHydrateRenderer,
  type HtmlHostModule,
  type HtmlHostServerModuleLoader,
  type RenderHtmlHostInput,
} from "@ox-content/vite-plugin";
import type { ComponentsMap } from "./types";

export interface SolidHtmlHostModule extends HtmlHostModule {}
export interface SolidHtmlHostClientModule extends HtmlHostClientModule {}
export type SolidHtmlHostDiagnosticCode = HtmlHostDiagnosticCode;
export interface SolidHtmlHostDiagnostic extends HtmlHostDiagnostic {}
export type SolidServerModuleLoader = HtmlHostServerModuleLoader;
export type SolidHtmlComponentRenderer = HtmlHostComponentRenderer;
export type SolidClientModuleResolver = (
  module: SolidHtmlHostModule,
  context: { documentPath: string },
) => string | undefined;

export interface RenderSolidHtmlHostInput extends Omit<
  RenderHtmlHostInput,
  "components" | "frameworkName" | "adapter" | "renderComponent" | "resolveClientModule"
> {
  components?: ComponentsMap;
  renderComponent?: SolidHtmlComponentRenderer;
  resolveClientModule?: SolidClientModuleResolver;
}

export interface RenderSolidHtmlHostResult {
  html: string;
  headHtml: string;
  headContributions: SolidHtmlHostHeadContribution[];
  modules: SolidHtmlHostModule[];
  clientModules: SolidHtmlHostClientModule[];
  diagnostics: SolidHtmlHostDiagnostic[];
}
export interface SolidHtmlHostHeadContribution extends HtmlHostHeadContribution {}

export type SolidHostHydrateRenderer = HtmlHostHydrateRenderer;
export type CreateSolidHtmlHostHydrateInput = CreateHtmlHostHydrateInput;

export async function renderSolidHtmlHost(
  input: RenderSolidHtmlHostInput,
): Promise<RenderSolidHtmlHostResult> {
  const resolveClientModule: RenderHtmlHostInput["resolveClientModule"] = input.resolveClientModule;
  return (await renderHtmlHost({
    ...input,
    frameworkName: "Solid",
    renderComponent: input.renderComponent ?? defaultRenderComponent,
    resolveClientModule,
  })) as RenderSolidHtmlHostResult;
}

export function createSolidHtmlHostHydrate(
  input: CreateSolidHtmlHostHydrateInput,
): (element: HTMLElement, props: Record<string, unknown>) => void | (() => void) {
  return createHtmlHostHydrate(input);
}

async function defaultRenderComponent(
  component: unknown,
  props: Record<string, unknown>,
  slotHtml: string | undefined,
): Promise<string> {
  const [{ renderToString, ssr }, { createComponent }] = await Promise.all([
    import("@solidjs/web"),
    import("solid-js"),
  ]);
  const componentProps = slotHtml ? { ...props, children: ssr([slotHtml]) } : props;
  return renderToString(() => createComponent(component as never, componentProps as never));
}
