import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MARKDOWN_EXTENSION = ".md";

export function toUnixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export async function scanMarkdownFiles(inputDir: string): Promise<string[]> {
  const root = path.resolve(inputDir);
  await assertDirectoryExists(root, "Input");
  const files = await scanDirectory(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export async function assertMarkdownFilesExist(inputDir: string, files: string[]): Promise<void> {
  if (files.length > 0) {
    return;
  }

  throw new Error(`No Markdown files found in ${path.resolve(inputDir)}.`);
}

export function assertPathPairIsSafe(inputDir: string, outputDir: string): void {
  const resolvedInputDir = path.resolve(inputDir);
  const resolvedOutputDir = path.resolve(outputDir);

  if (resolvedInputDir === resolvedOutputDir) {
    throw new Error("Input and output directories must be different.");
  }

  if (isNestedPath(resolvedInputDir, resolvedOutputDir) || isNestedPath(resolvedOutputDir, resolvedInputDir)) {
    throw new Error("Input and output directories must not overlap.");
  }
}

async function scanDirectory(currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return scanDirectory(absolutePath);
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
        return [absolutePath];
      }

      return [];
    }),
  );

  return results.flat();
}

export function getRelativeMarkdownPath(rootDir: string, filePath: string): string {
  return toUnixPath(path.relative(path.resolve(rootDir), filePath));
}

export function getOutputPath(outputDir: string, relativePath: string): string {
  return path.join(path.resolve(outputDir), ...relativePath.split("/"));
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeMirroredFile(outputPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

async function assertDirectoryExists(targetPath: string, label: string): Promise<void> {
  let targetStats;

  try {
    targetStats = await stat(targetPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`${label} directory not found: ${targetPath}`);
    }

    throw error;
  }

  if (!targetStats.isDirectory()) {
    throw new Error(`${label} path is not a directory: ${targetPath}`);
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isNestedPath(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
