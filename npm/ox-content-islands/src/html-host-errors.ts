export type HtmlHostClientDiagnosticCode =
  | "missing-island-name"
  | "missing-module-id"
  | "unknown-module"
  | "module-load-failed"
  | "runtime-load-failed"
  | "missing-export"
  | "render-failed";

export interface HtmlHostClientError {
  code: HtmlHostClientDiagnosticCode;
  message: string;
  element: HTMLElement;
  props: Record<string, unknown>;
  componentName?: string;
  moduleId?: string;
  exportName?: string;
  cause?: unknown;
}

export class HtmlHostClientHydrationError extends Error {
  readonly diagnostic: HtmlHostClientError;

  constructor(diagnostic: HtmlHostClientError) {
    super(diagnostic.message);
    this.name = "HtmlHostClientHydrationError";
    this.diagnostic = diagnostic;
  }
}

interface HtmlHostClientErrorContext {
  componentName?: string;
  moduleId?: string;
  exportName?: string;
  cause?: unknown;
  frameworkName?: string;
}

export function reportHtmlHostClientError(
  input: { onError?: (error: HtmlHostClientError) => void },
  error: HtmlHostClientError,
  eventName = "ox-content-html-host:error",
): void {
  error.element.classList?.add("ox-island-error");
  error.element.dataset.oxError = error.message;
  input.onError?.(error);

  if (typeof CustomEvent === "function" && typeof error.element.dispatchEvent === "function") {
    error.element.dispatchEvent(new CustomEvent(eventName, { detail: error }));
  }
}

export function createHtmlHostClientError(
  code: HtmlHostClientDiagnosticCode,
  element: HTMLElement,
  props: Record<string, unknown>,
  context: HtmlHostClientErrorContext = {},
): HtmlHostClientError {
  return {
    code,
    element,
    props,
    componentName: context.componentName,
    moduleId: context.moduleId,
    exportName: context.exportName,
    cause: context.cause,
    message: clientErrorMessage(code, context),
  };
}

export function once(cleanup: () => void): () => void {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    cleanup();
  };
}

function clientErrorMessage(
  code: HtmlHostClientDiagnosticCode,
  context: HtmlHostClientErrorContext,
): string {
  const framework = context.frameworkName?.trim() || "HTML host";
  const island = `${framework} island`;
  const component = context.componentName ? `${island} "${context.componentName}"` : island;
  const reason = causeMessage(context.cause);
  switch (code) {
    case "missing-island-name":
      return `${island} element is missing data-ox-island.`;
    case "missing-module-id":
      return `${component} is missing data-ox-module.`;
    case "unknown-module":
      return `${component} references unknown module "${context.moduleId ?? ""}".`;
    case "module-load-failed":
      return `${component} module "${context.moduleId ?? ""}" failed to load: ${reason}`;
    case "runtime-load-failed":
      return `${framework} runtime failed to load: ${reason}`;
    case "missing-export":
      return `${component} module "${context.moduleId ?? ""}" is missing export "${context.exportName ?? "default"}".`;
    case "render-failed":
      return `${component} failed to render: ${reason}`;
  }
}

function causeMessage(cause: unknown): string {
  if (cause == null) return "";
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  if (typeof cause === "number" || typeof cause === "boolean") return cause.toString();
  try {
    return JSON.stringify(cause);
  } catch {
    return Object.prototype.toString.call(cause);
  }
}
