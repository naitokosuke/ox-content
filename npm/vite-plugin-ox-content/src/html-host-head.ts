import type {
  HtmlHostComponentRenderOutput,
  HtmlHostComponentRenderResult,
  HtmlHostHeadContribution,
} from "./html-host";

export interface HtmlHostHeadResult {
  order: number;
  contributions: readonly HtmlHostHeadContribution[];
}

export function normalizeRenderResult(
  rendered: HtmlHostComponentRenderOutput,
): HtmlHostComponentRenderResult {
  return typeof rendered === "string" ? { html: rendered } : rendered;
}

export function headContributionsFromRenderResult(
  result: HtmlHostComponentRenderResult,
  context: Pick<HtmlHostHeadContribution, "component" | "moduleId">,
): HtmlHostHeadContribution[] {
  return splitHeadFragments(result.head).map((fragment) => ({
    ...context,
    html: fragment,
  }));
}

export function dedupeHeadContributions(
  results: readonly HtmlHostHeadResult[],
): HtmlHostHeadContribution[] {
  const seen = new Set<string>();
  const contributions: HtmlHostHeadContribution[] = [];
  for (const result of [...results].sort((left, right) => left.order - right.order)) {
    for (const contribution of result.contributions) {
      if (seen.has(contribution.html)) continue;
      seen.add(contribution.html);
      contributions.push(contribution);
    }
  }
  return contributions;
}

function splitHeadFragments(head: string | undefined): string[] {
  const html = head?.trim();
  if (!html) return [];

  const fragments: string[] = [];
  const pattern =
    /<!--[\s\S]*?-->|<(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b[^>]*>|<([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>[\s\S]*?<\/\2\s*>/giu;
  let index = 0;
  for (const match of html.matchAll(pattern)) {
    const offset = match.index ?? 0;
    const leading = html.slice(index, offset).trim();
    if (leading) {
      fragments.push(leading);
    }
    fragments.push(match[0].trim());
    index = offset + match[0].length;
  }
  const trailing = html.slice(index).trim();
  if (trailing) {
    fragments.push(trailing);
  }
  return fragments;
}
