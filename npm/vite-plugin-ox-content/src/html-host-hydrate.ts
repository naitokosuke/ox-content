const ISLAND_JSON_SCRIPT = /^\s*<script type="application\/json">[\s\S]*?<\/script>/;

export type HtmlHostHydrateRenderer = (
  component: unknown,
  props: Record<string, unknown>,
  element: HTMLElement,
  slotHtml: string | undefined,
) => void | (() => void);

export interface CreateHtmlHostHydrateInput {
  components: Readonly<Record<string, unknown>> | ReadonlyMap<string, unknown>;
  render: HtmlHostHydrateRenderer;
}

export function createHtmlHostHydrate(
  input: CreateHtmlHostHydrateInput,
): (element: HTMLElement, props: Record<string, unknown>) => void | (() => void) {
  return (element, props) => {
    const name = element.dataset.oxIsland;
    if (!name) {
      return undefined;
    }
    const component = componentFromRegistry(input.components, name);
    if (!component) {
      return undefined;
    }
    const slotHtml = readIslandSlotHtml(element);
    element.innerHTML = "";
    return input.render(component, props, element, slotHtml || undefined);
  };
}

function componentFromRegistry(
  registry: CreateHtmlHostHydrateInput["components"],
  name: string,
): unknown {
  return isReadonlyMap(registry) ? registry.get(name) : registry[name];
}

function isReadonlyMap(
  value: CreateHtmlHostHydrateInput["components"],
): value is ReadonlyMap<string, unknown> {
  return typeof (value as ReadonlyMap<string, unknown>).get === "function";
}

function readIslandSlotHtml(element: Pick<HTMLElement, "dataset" | "innerHTML">): string {
  const fromAttr = element.dataset.oxContent;
  if (fromAttr) return fromAttr;
  if (element.dataset.oxSsr === "true") return "";
  return element.innerHTML.replace(ISLAND_JSON_SCRIPT, "");
}
