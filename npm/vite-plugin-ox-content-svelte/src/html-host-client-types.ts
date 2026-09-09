import type { HydrateFunction, InitIslandsOptions } from "@ox-content/islands";
import type {
  HtmlHostClientContext,
  HtmlHostClientDiagnosticCode,
  HtmlHostClientError,
  HtmlHostClientModuleLoader,
  HtmlHostClientRenderer,
  HtmlHostClientRuntimeLoader,
  HtmlHostExportNameResolver,
  HtmlHostHydrationHandle,
  HtmlHostModuleIdResolver,
} from "@ox-content/islands/html-host";

export type SvelteHtmlHostClientDiagnosticCode = HtmlHostClientDiagnosticCode;
export type SvelteHtmlHostClientError = HtmlHostClientError;
export type SvelteHtmlHostClientComponentValue = unknown;
export type SvelteHtmlHostClientModuleValue = SvelteHtmlHostClientComponentValue;

export type SvelteHtmlHostClientModuleLoader<TModule = SvelteHtmlHostClientModuleValue> =
  HtmlHostClientModuleLoader<TModule>;

export type SvelteHtmlHostClientModules =
  | Readonly<Record<string, SvelteHtmlHostClientModuleLoader>>
  | ReadonlyMap<string, SvelteHtmlHostClientModuleLoader>;

export type SvelteHtmlHostClientContext<TRuntime = undefined> = HtmlHostClientContext<TRuntime>;

export type SvelteHtmlHostClientRenderer<TRuntime = undefined> = HtmlHostClientRenderer<TRuntime>;

export type SvelteHtmlHostClientRuntimeLoader<TRuntime = undefined> =
  HtmlHostClientRuntimeLoader<TRuntime>;

export type SvelteHtmlHostModuleIdResolver = HtmlHostModuleIdResolver;
export type SvelteHtmlHostExportNameResolver = HtmlHostExportNameResolver;
export type SvelteHtmlHostHydrationHandle = HtmlHostHydrationHandle;

export interface SvelteHtmlHostClientBaseInput<TRuntime = undefined> {
  modules: SvelteHtmlHostClientModules;
  loadRuntime?: SvelteHtmlHostClientRuntimeLoader<TRuntime>;
  resolveModuleId?: SvelteHtmlHostModuleIdResolver;
  resolveExportName?: SvelteHtmlHostExportNameResolver;
  onError?: (error: SvelteHtmlHostClientError) => void;
}

export interface CreateSvelteHtmlHostLazyHydrateRenderInput<
  TRuntime = undefined,
> extends SvelteHtmlHostClientBaseInput<TRuntime> {
  render: SvelteHtmlHostClientRenderer<TRuntime>;
  mount?: never;
}

export interface CreateSvelteHtmlHostLazyHydrateMountInput extends SvelteHtmlHostClientBaseInput<SvelteHtmlHostDomRuntime> {
  mount: SvelteHtmlHostDomRendererInput;
  render?: never;
}

export type CreateSvelteHtmlHostLazyHydrateInput<TRuntime = undefined> =
  | CreateSvelteHtmlHostLazyHydrateRenderInput<TRuntime>
  | CreateSvelteHtmlHostLazyHydrateMountInput;

export type SvelteHtmlHostDomMode = "render" | "hydrate";

export interface SvelteHtmlHostDomRendererInput {
  mode: SvelteHtmlHostDomMode;
}

export interface SvelteHtmlHostDomRuntime {
  mount: (
    component: SvelteHtmlHostClientComponentValue,
    options: { target: HTMLElement; props?: Record<string, unknown> },
  ) => unknown;
  hydrate: (
    component: SvelteHtmlHostClientComponentValue,
    options: { target: HTMLElement; props?: Record<string, unknown> },
  ) => unknown;
  unmount: (instance: unknown) => void | Promise<void>;
  createRawSnippet: (
    factory: () => {
      render: () => string;
      setup?: (element: Element) => void;
    },
  ) => unknown;
}

export type SvelteHtmlHostInitIslands<TController = unknown> = (
  hydrate: HydrateFunction,
  options?: InitIslandsOptions,
) => TController;

export type InitSvelteHtmlHostInput<TRuntime = undefined> =
  CreateSvelteHtmlHostLazyHydrateInput<TRuntime> & {
    initIslands: SvelteHtmlHostInitIslands;
    options?: InitIslandsOptions;
  };
