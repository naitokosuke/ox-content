import fs from "node:fs";
import path from "node:path";

export type HtmlHostComponentsMap = Record<string, string>;
export type HtmlHostComponentsOption = HtmlHostComponentsMap | string | string[];

export async function resolveHtmlHostComponentsGlob(
  componentsOption: HtmlHostComponentsOption,
  root: string,
): Promise<HtmlHostComponentsMap> {
  if (typeof componentsOption === "object" && !Array.isArray(componentsOption)) {
    return componentsOption;
  }

  const patterns = Array.isArray(componentsOption) ? componentsOption : [componentsOption];
  const result: HtmlHostComponentsMap = {};

  for (const pattern of patterns) {
    for (const file of await globFiles(pattern, root)) {
      const baseName = path.basename(file, path.extname(file));
      const relativePath = "./" + path.relative(root, file).replace(/\\/g, "/");
      result[toPascalCase(baseName)] = relativePath;
    }
  }

  return result;
}

async function globFiles(pattern: string, root: string): Promise<string[]> {
  const files: string[] = [];
  const normalized = pattern.replace(/\\/g, "/").replace(/^\.\//, "");

  if (!hasWildcard(normalized)) {
    const fullPath = path.resolve(root, normalized);
    if (fs.existsSync(fullPath)) {
      files.push(fullPath);
    }
    return files;
  }

  const baseDir = path.resolve(root, staticPrefix(normalized));
  if (!fs.existsSync(baseDir)) {
    return files;
  }

  const segments = normalized.split("/");
  const crossesDirectories = normalized.includes("**") || segments.slice(0, -1).some(hasWildcard);

  const candidates: string[] = [];
  if (crossesDirectories) {
    await walkDir(baseDir, candidates);
  } else {
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        candidates.push(path.join(baseDir, entry.name));
      }
    }
  }

  const matcher = globToRegExp(normalized);
  for (const candidate of candidates) {
    if (matcher.test(path.relative(root, candidate).replace(/\\/g, "/"))) {
      files.push(candidate);
    }
  }

  return files;
}

function hasWildcard(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?");
}

function staticPrefix(pattern: string): string {
  const segments: string[] = [];
  for (const segment of pattern.split("/")) {
    if (hasWildcard(segment)) break;
    segments.push(segment);
  }
  return segments.join("/");
}

function globToRegExp(pattern: string): RegExp {
  let source = "";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        index += 2;
        if (pattern[index] === "/") {
          index += 1;
          source += "(?:[^/]+/)*";
        } else {
          source += ".*";
        }
        continue;
      }
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    index += 1;
  }

  return new RegExp(`^${source}$`);
}

async function walkDir(dir: string, files: string[]): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkDir(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

function toPascalCase(str: string): string {
  return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase());
}
