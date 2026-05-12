import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { FrontmatterData, NormalizedDocument } from "../types.js";
import { getOutputPath, getRelativeMarkdownPath } from "./scanner.js";

const FRONTMATTER_FENCE = "---";
const H1_PATTERN = /^#\s+(.+?)\s*$/m;
const TITLE_PATTERN = /^title\s*:\s*(.+?)\s*$/m;
const SLUG_PATTERN = /^slug\s*:\s*(.+?)\s*$/m;
const DATE_PATTERN = /^date\s*[:=]\s*(.*?)\s*$/m;
const DATE_KEY_PATTERN = /^date\s*[:=]/m;
const INLINE_ALIASES_PATTERN = /^aliases\s*:\s*\[(.*)\]\s*$/m;
const BLOCK_ALIASES_PATTERN = /^aliases\s*:\s*$/m;
const BLOCK_ALIAS_ITEM_PATTERN = /^\s*-\s+(.+?)\s*$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const FILENAME_DATE_PATTERNS = [
  /(?:^|[^\d])(\d{4})-(\d{2})-(\d{2})(?=[^\d]|$)/,
  /(?:^|[^\d])(\d{4})\.(\d{2})\.(\d{2})(?=[^\d]|$)/,
  /(?:^|[^\d])(\d{4})_(\d{2})_(\d{2})(?=[^\d]|$)/,
  /(?:^|[^\d])(\d{4})(\d{2})(\d{2})(?=[^\d]|$)/,
];

const execFileAsync = promisify(execFile);

interface FrontmatterSection {
  data: FrontmatterData;
  body: string;
  raw?: string;
  hadFrontmatter: boolean;
  hasDate: boolean;
}

export function normalizeMarkdownDocument(args: {
  content: string;
  inputRoot: string;
  outputRoot: string;
  sourcePath: string;
  ensureFrontmatter?: boolean;
  frontmatterDate?: string | undefined;
}): NormalizedDocument {
  const relativePath = getRelativeMarkdownPath(args.inputRoot, args.sourcePath);
  const outputPath = getOutputPath(args.outputRoot, relativePath);
  const frontmatterSection = parseFrontmatter(args.content);
  const fallbackTitle = extractFallbackTitle(frontmatterSection.body, args.sourcePath);
  const title = frontmatterSection.data.title ?? fallbackTitle;
  const aliases = frontmatterSection.data.aliases;
  const date = frontmatterSection.hasDate || args.ensureFrontmatter === false
    ? undefined
    : args.frontmatterDate ?? extractDateFromFilename(args.sourcePath);
  const normalizedContent = normalizeFrontmatterContent({
    body: frontmatterSection.body,
    content: args.content,
    date,
    frontmatterSection,
    title,
    shouldEnsureFrontmatter: args.ensureFrontmatter !== false,
  });

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

export async function resolveFrontmatterDate(args: { content: string; sourcePath: string }): Promise<string | undefined> {
  const frontmatterSection = parseFrontmatter(args.content);
  if (frontmatterSection.hasDate) {
    return undefined;
  }

  return extractDateFromFilename(args.sourcePath)
    ?? await getGitFirstCommitDate(args.sourcePath)
    ?? await getFilesystemCreationDate(args.sourcePath);
}

export function parseFrontmatter(content: string): FrontmatterSection {
  if (!content.startsWith(`${FRONTMATTER_FENCE}\n`)) {
    return {
      data: { aliases: [] },
      body: content,
      hadFrontmatter: false,
      hasDate: false,
    };
  }

  const closingIndex = content.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length + 1);
  if (closingIndex === -1) {
    return {
      data: { aliases: [] },
      body: content,
      hadFrontmatter: false,
      hasDate: false,
    };
  }

  const frontmatterEnd = closingIndex + `\n${FRONTMATTER_FENCE}`.length;
  const raw = content.slice(0, frontmatterEnd);
  const body = content.slice(frontmatterEnd).replace(/^\n+/, "");

  return {
    data: extractFrontmatterData(raw),
    body,
    raw,
    hadFrontmatter: true,
    hasDate: hasFrontmatterDate(raw),
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
  const dateMatch = inner.match(DATE_PATTERN);
  const date = dateMatch?.[1] ? stripQuotes(dateMatch[1]) : undefined;

  if (title) {
    return {
      title,
      ...(slug ? { slug } : {}),
      ...(date ? { date } : {}),
      aliases: extractAliases(inner),
    };
  }

  return {
    ...(slug ? { slug } : {}),
    ...(date ? { date } : {}),
    aliases: extractAliases(inner),
  };
}

function normalizeFrontmatterContent(args: {
  body: string;
  content: string;
  date: string | undefined;
  frontmatterSection: FrontmatterSection;
  title: string;
  shouldEnsureFrontmatter: boolean;
}): string {
  if (!args.shouldEnsureFrontmatter) {
    return args.content;
  }

  if (!args.frontmatterSection.hadFrontmatter) {
    return createFrontmatter(args.title, args.body, args.date);
  }

  if (!args.date || !args.frontmatterSection.raw) {
    return args.content;
  }

  return addFrontmatterDate(args.frontmatterSection, args.date);
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

function hasFrontmatterDate(raw: string): boolean {
  const inner = raw
    .replace(/^---\n/, "")
    .replace(/\n---$/, "");
  return DATE_KEY_PATTERN.test(inner);
}

function extractFallbackTitle(body: string, sourcePath: string): string {
  const h1Match = body.match(H1_PATTERN);
  const h1Title = h1Match?.[1];
  if (h1Title) {
    return h1Title.trim();
  }

  return path.basename(sourcePath, path.extname(sourcePath));
}

function createFrontmatter(title: string, body: string, date?: string): string {
  const dateLine = date ? `\ndate: ${date}` : "";
  return `---\ntitle: ${quoteYamlString(title)}${dateLine}\n---\n\n${body}`;
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

function addFrontmatterDate(frontmatterSection: FrontmatterSection, date: string): string {
  if (!frontmatterSection.raw) {
    return frontmatterSection.body;
  }

  const lines = frontmatterSection.raw.split("\n");
  const closingIndex = lines.lastIndexOf(FRONTMATTER_FENCE);
  if (closingIndex <= 0) {
    return `${frontmatterSection.raw}\n${frontmatterSection.body}`;
  }

  const dateLine = `date: ${date}`;
  const frontmatterLines = lines.slice(1, closingIndex);
  const titleIndex = frontmatterLines.findIndex((line) => TITLE_PATTERN.test(line));
  if (titleIndex >= 0) {
    frontmatterLines.splice(titleIndex + 1, 0, dateLine);
  } else {
    frontmatterLines.push(dateLine);
  }

  const rebuiltFrontmatter = [FRONTMATTER_FENCE, ...frontmatterLines, FRONTMATTER_FENCE].join("\n");
  const separator = frontmatterSection.body.length > 0 ? "\n\n" : "\n";
  return `${rebuiltFrontmatter}${separator}${frontmatterSection.body}`;
}

function extractDateFromFilename(filePath: string): string | undefined {
  const basename = path.basename(filePath, path.extname(filePath));

  for (const pattern of FILENAME_DATE_PATTERNS) {
    const match = basename.match(pattern);
    const [, year, month, day] = match ?? [];
    const normalizedDate = normalizeDateParts(year, month, day);
    if (normalizedDate) {
      return normalizedDate;
    }
  }

  return undefined;
}

function normalizeDateParts(year?: string, month?: string, day?: string): string | undefined {
  if (!year || !month || !day) {
    return undefined;
  }

  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const date = new Date(Date.UTC(Number(year), monthNumber - 1, dayNumber));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== monthNumber - 1 ||
    date.getUTCDate() !== dayNumber
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

async function getGitFirstCommitDate(filePath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--diff-filter=A", "--follow", "--format=%aI", "--", filePath],
      { cwd: path.dirname(filePath) },
    );
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    const firstCommitDate = lines.at(-1);
    return extractIsoDate(firstCommitDate);
  } catch {
    return undefined;
  }
}

async function getFilesystemCreationDate(filePath: string): Promise<string | undefined> {
  try {
    const stats = await stat(filePath);
    return formatLocalDate(stats.birthtime);
  } catch {
    return undefined;
  }
}

function extractIsoDate(value?: string): string | undefined {
  const match = value?.match(ISO_DATE_PATTERN);
  return match?.[0];
}

function formatLocalDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
