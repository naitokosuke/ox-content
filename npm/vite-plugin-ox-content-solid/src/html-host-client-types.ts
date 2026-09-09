import type { HydrateFunction, InitIslandsOptions } from "@ox-content/islands";
import type {
  HtmlHostClientContext,
  HtmlHostClientDiagnosticCode,
  HtmlHostClientError,
  HtmlHostClientModuleLoader as GenericHtmlHostClientModuleLoader,
  HtmlHostClientRenderer,
  HtmlHostClientRuntimeLoader,
  HtmlHostExportNameResolver,
  HtmlHostHydrationHandle,
  HtmlHostModuleIdResolver,
} from "@ox-content/islands/html-host";

export type SolidHtmlHostClientDiagnosticCode = HtmlHostClientDiagnosticCode;
export type SolidHtmlHostClientError = HtmlHostClientError;

export type SolidHtmlHostClientComponentValue = (...args: never[]) => unknown;
export type SolidHtmlHostClientModuleValue =
  | Record<string, unknown>
  | SolidHtmlHostClientComponentValue;

export type SolidHtmlHostClientModuleLoader<
  TModule extends object = SolidHtmlHostClientModuleValue,
> = GenericHtmlHostClientModuleLoader<TModule>;

export type SolidHtmlHostClientModules =
  | Readonly<Record<string, SolidHtmlHostClientModuleLoader>>
  | ReadonlyMap<string, SolidHtmlHostClientModuleLoader>;

export type SolidHtmlHostClientContext<TRuntime = undefined> = HtmlHostClientContext<TRuntime>;

export type SolidHtmlHostClientRenderer<TRuntime = undefined> = HtmlHostClientRenderer<TRuntime>;

export type SolidHtmlHostClientRuntimeLoader<TRuntime = undefined> =
  HtmlHostClientRuntimeLoader<TRuntime>;

export type SolidHtmlHostModuleIdResolver = HtmlHostModuleIdResolver;
export type SolidHtmlHostExportNameResolver = HtmlHostExportNameResolver;
export type SolidHtmlHostHydrationHandle = HtmlHostHydrationHandle;

export interface SolidHtmlHostClientBaseInput<TRuntime = undefined> {
  modules: SolidHtmlHostClientModules;
  loadRuntime?: SolidHtmlHostClientRuntimeLoader<TRuntime>;
  resolveModuleId?: SolidHtmlHostModuleIdResolver;
  resolveExportName?: SolidHtmlHostExportNameResolver;
  onError?: (error: SolidHtmlHostClientError) => void;
}

export interface CreateSolidHtmlHostLazyHydrateRenderInput<
  TRuntime = undefined,
> extends SolidHtmlHostClientBaseInput<TRuntime> {
  render: SolidHtmlHostClientRenderer<TRuntime>;
  mount?: never;
}

export interface CreateSolidHtmlHostLazyHydrateMountInput extends SolidHtmlHostClientBaseInput<SolidHtmlHostDomRuntime> {
  mount: SolidHtmlHostDomRendererInput;
  render?: never;
}

export type CreateSolidHtmlHostLazyHydrateInput<TRuntime = undefined> =
  | CreateSolidHtmlHostLazyHydrateRenderInput<TRuntime>
  | CreateSolidHtmlHostLazyHydrateMountInput;

export type SolidHtmlHostDomMode = "render" | "hydrate";

export interface SolidHtmlHostDomRendererInput {
  mode: SolidHtmlHostDomMode;
}

export interface SolidHtmlHostDomRuntime {
  createComponent: (
    component: SolidHtmlHostClientComponentValue,
    props: Record<string, unknown>,
  ) => unknown;
  render: (code: () => unknown, element: HTMLElement) => () => void;
  hydrate: (code: () => unknown, element: HTMLElement) => () => void;
}

export type SolidHtmlHostInitIslands<TController = unknown> = (
  hydrate: HydrateFunction,
  options?: InitIslandsOptions,
) => TController;

export type InitSolidHtmlHostInput<TRuntime = undefined> =
  CreateSolidHtmlHostLazyHydrateInput<TRuntime> & {
    initIslands: SolidHtmlHostInitIslands;
    options?: InitIslandsOptions;
  };
