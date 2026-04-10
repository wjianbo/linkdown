import path from "node:path";
import { BacklinksCollector } from "../core/backlinks.js";
import { normalizeMarkdownDocument } from "../core/frontmatter.js";
import { createLinkIndex } from "../core/resolver.js";
import { assertMarkdownFilesExist, assertPathPairIsSafe, isIgnoredMarkdownFile, readTextFile, scanMarkdownFiles, writeMirroredFile, } from "../core/scanner.js";
import { replaceWikilinks } from "../core/wikilink.js";
export async function runBuildCommand(inputDir, outputDir) {
    assertPathPairIsSafe(inputDir, outputDir);
    const files = await scanMarkdownFiles(inputDir);
    await assertMarkdownFilesExist(inputDir, files);
    const documents = await Promise.all(files.map(async (filePath) => {
        const content = await readTextFile(filePath);
        return normalizeMarkdownDocument({
            content,
            inputRoot: inputDir,
            outputRoot: outputDir,
            sourcePath: filePath,
            ensureFrontmatter: !isIgnoredMarkdownFile(filePath),
        });
    }));
    const reports = {
        unresolved: {},
        ambiguous: {},
        backlinks: {},
    };
    const backlinks = new BacklinksCollector();
    const linkIndex = createLinkIndex(documents);
    await Promise.all(documents.map(async (document) => {
        const transformedContent = replaceWikilinks(document.content, (wikilink) => {
            const resolution = linkIndex.resolve(wikilink);
            if (resolution.kind === "resolved") {
                backlinks.add(document.relativePath, resolution.targetPath);
                return resolution.markdown;
            }
            const report = resolution.kind === "unresolved" ? reports.unresolved : reports.ambiguous;
            const existingEntries = report[document.relativePath] ?? [];
            if (!existingEntries.includes(resolution.requestedTitle)) {
                existingEntries.push(resolution.requestedTitle);
            }
            report[document.relativePath] = existingEntries;
            return wikilink.raw;
        });
        await writeMirroredFile(document.outputPath, transformedContent);
    }));
    reports.backlinks = backlinks.toJSON();
    await Promise.all([
        writeReport(path.join(outputDir, "unresolved.json"), reports.unresolved),
        writeReport(path.join(outputDir, "ambiguous.json"), reports.ambiguous),
        writeReport(path.join(outputDir, "backlinks.json"), reports.backlinks),
    ]);
}
async function writeReport(outputPath, data) {
    const sortedData = Object.fromEntries(Object.entries(data)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, values]) => [key, [...new Set(values)].sort((left, right) => left.localeCompare(right))]));
    await writeMirroredFile(outputPath, `${JSON.stringify(sortedData, null, 2)}\n`);
}
//# sourceMappingURL=build.js.map