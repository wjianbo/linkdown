import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
const MARKDOWN_EXTENSION = ".md";
const IGNORED_FILE_PREFIX = "_";
export function toUnixPath(value) {
    return value.split(path.sep).join("/");
}
export async function scanMarkdownFiles(inputDir) {
    const root = path.resolve(inputDir);
    await assertDirectoryExists(root, "Input");
    const files = await scanDirectory(root);
    return files.sort((left, right) => left.localeCompare(right));
}
export async function assertMarkdownFilesExist(inputDir, files) {
    if (files.length > 0) {
        return;
    }
    throw new Error(`No Markdown files found in ${path.resolve(inputDir)}.`);
}
export function assertPathPairIsSafe(inputDir, outputDir) {
    const resolvedInputDir = path.resolve(inputDir);
    const resolvedOutputDir = path.resolve(outputDir);
    if (resolvedInputDir === resolvedOutputDir) {
        throw new Error("Input and output directories must be different.");
    }
    if (isNestedPath(resolvedInputDir, resolvedOutputDir) || isNestedPath(resolvedOutputDir, resolvedInputDir)) {
        throw new Error("Input and output directories must not overlap.");
    }
}
async function scanDirectory(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const results = await Promise.all(entries.map(async (entry) => {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            return scanDirectory(absolutePath);
        }
        if (entry.isFile() &&
            entry.name.toLowerCase().endsWith(MARKDOWN_EXTENSION) &&
            !entry.name.startsWith(IGNORED_FILE_PREFIX)) {
            return [absolutePath];
        }
        return [];
    }));
    return results.flat();
}
export function getRelativeMarkdownPath(rootDir, filePath) {
    return toUnixPath(path.relative(path.resolve(rootDir), filePath));
}
export function getOutputPath(outputDir, relativePath) {
    return path.join(path.resolve(outputDir), ...relativePath.split("/"));
}
export async function readTextFile(filePath) {
    return readFile(filePath, "utf8");
}
export async function writeMirroredFile(outputPath, content) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
}
async function assertDirectoryExists(targetPath, label) {
    let targetStats;
    try {
        targetStats = await stat(targetPath);
    }
    catch (error) {
        if (isMissingPathError(error)) {
            throw new Error(`${label} directory not found: ${targetPath}`);
        }
        throw error;
    }
    if (!targetStats.isDirectory()) {
        throw new Error(`${label} path is not a directory: ${targetPath}`);
    }
}
function isMissingPathError(error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function isNestedPath(parentPath, childPath) {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
//# sourceMappingURL=scanner.js.map