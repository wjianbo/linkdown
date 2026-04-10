import path from "node:path";

import type { FrontmatterData, NormalizedDocument } from "../types.js";
import { getOutputPath, getRelativeMarkdownPath } from "./scanner.js";

const FRONTMATTER_FENCE = "---";
const H1_PATTERN = /^#\s+(.+?)\s*$/m;
const TITLE_PATTERN = /^title\s*:\s*(.+?)\s*$/m;
const SLUG_PATTERN = /^slug\s*:\s*(.+?)\s*$/m;
const INLINE_ALIASES_PATTERN = /^aliases\s*:\s*\[(.*)\]\s*$/m;
const BLOCK_ALIASES_PATTERN = /^aliases\s*:\s*$/m;
const BLOCK_ALIAS_ITEM_PATTERN = /^\s*-\s+(.+?)\s*$/;

interface FrontmatterSection {
  data: FrontmatterData;
  body: string;
  raw?: string;
  hadFrontmatter: boolean;
}

export function normalizeMarkdownDocument(args: {
  content: string;
  inputRoot: string;
  outputRoot: string;
  sourcePath: string;
  ensureFrontmatter?: boolean;
}): NormalizedDocument {
  const relativePath = getRelativeMarkdownPath(args.inputRoot, args.sourcePath);
  const outputPath = getOutputPath(args.outputRoot, relativePath);
  const frontmatterSection = parseFrontmatter(args.content);
  const fallbackTitle = extractFallbackTitle(frontmatterSection.body, args.sourcePath);
  const title = frontmatterSection.data.title ?? fallbackTitle;
  const aliases = frontmatterSection.data.aliases;
  const normalizedContent = frontmatterSection.hadFrontmatter || args.ensureFrontmatter === false
    ? args.content
    : createFrontmatter(title, frontmatterSection.body);

  return {
    sourcePath: args.sourcePath,
    relativePath,
    outputPath,
    content: normalizedContent,
    title,
    aliases,
    frontmatter: frontmatterSection.data,
    hadFrontmatter: frontmatterSection.hadFrontmatter,
  };
}

export function parseFrontmatter(content: string): FrontmatterSection {
  if (!content.startsWith(`${FRONTMATTER_FENCE}\n`)) {
    return {
      data: { aliases: [] },
      body: content,
      hadFrontmatter: false,
    };
  }

  const closingIndex = content.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length + 1);
  if (closingIndex === -1) {
    return {
      data: { aliases: [] },
      body: content,
      hadFrontmatter: false,
    };
  }

  const frontmatterEnd = closingIndex + `\n${FRONTMATTER_FENCE}`.length;
  const raw = content.slice(0, frontmatterEnd);
  const body = content.slice(frontmatterEnd).replace(/^\n/, "");

  return {
    data: extractFrontmatterData(raw),
    body,
    raw,
    hadFrontmatter: true,
  };
}

function extractFrontmatterData(raw: string): FrontmatterData {
  const inner = raw
    .replace(/^---\n/, "")
    .replace(/\n---$/, "");
  const titleMatch = inner.match(TITLE_PATTERN);
  const title = titleMatch?.[1] ? stripQuotes(titleMatch[1]) : undefined;
  const slugMatch = inner.match(SLUG_PATTERN);
  const slug = slugMatch?.[1] ? stripQuotes(slugMatch[1]) : undefined;

  if (title) {
    return {
      title,
      ...(slug ? { slug } : {}),
      aliases: extractAliases(inner),
    };
  }

  return {
    ...(slug ? { slug } : {}),
    aliases: extractAliases(inner),
  };
}

function extractAliases(frontmatter: string): string[] {
  const inlineMatch = frontmatter.match(INLINE_ALIASES_PATTERN);
  const inlineAliases = inlineMatch?.[1];
  if (inlineAliases) {
    return inlineAliases
      .split(",")
      .map((value) => stripQuotes(value.trim()))
      .filter(Boolean);
  }

  const lines = frontmatter.split("\n");
  const aliases: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (!inBlock) {
      if (BLOCK_ALIASES_PATTERN.test(line)) {
        inBlock = true;
      }
      continue;
    }

    const match = line.match(BLOCK_ALIAS_ITEM_PATTERN);
    const aliasValue = match?.[1];
    if (aliasValue) {
      aliases.push(stripQuotes(aliasValue));
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    break;
  }

  return aliases;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function extractFallbackTitle(body: string, sourcePath: string): string {
  const h1Match = body.match(H1_PATTERN);
  const h1Title = h1Match?.[1];
  if (h1Title) {
    return h1Title.trim();
  }

  return path.basename(sourcePath, path.extname(sourcePath));
}

function createFrontmatter(title: string, body: string): string {
  return `---\ntitle: ${quoteYamlString(title)}\n---\n\n${body}`;
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}

export function updateFrontmatterSlug(content: string, slug: string): string {
  const frontmatterSection = parseFrontmatter(content);
  if (!frontmatterSection.hadFrontmatter || !frontmatterSection.raw) {
    return content;
  }

  if (frontmatterSection.data.slug) {
    return content;
  }

  const lines = frontmatterSection.raw.split("\n");
  const closingIndex = lines.lastIndexOf(FRONTMATTER_FENCE);
  if (closingIndex <= 0) {
    return content;
  }

  const slugLine = `slug: ${quoteYamlString(slug)}`;
  const frontmatterLines = lines.slice(1, closingIndex);
  const titleIndex = frontmatterLines.findIndex((line) => TITLE_PATTERN.test(line));
  if (titleIndex >= 0) {
    frontmatterLines.splice(titleIndex + 1, 0, slugLine);
  } else {
    frontmatterLines.push(slugLine);
  }

  const rebuiltFrontmatter = [FRONTMATTER_FENCE, ...frontmatterLines, FRONTMATTER_FENCE].join("\n");
  const separator = frontmatterSection.body.length > 0 ? "\n\n" : "\n";
  return `${rebuiltFrontmatter}${separator}${frontmatterSection.body}`;
}
