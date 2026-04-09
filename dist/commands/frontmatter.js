import { assertMarkdownFilesExist, assertPathPairIsSafe, getOutputPath, getRelativeMarkdownPath, isIgnoredMarkdownFile, readTextFile, scanMarkdownFiles, writeMirroredFile, } from "../core/scanner.js";
import { normalizeMarkdownDocument } from "../core/frontmatter.js";
export async function runFrontmatterCommand(inputDir, outputDir) {
    assertPathPairIsSafe(inputDir, outputDir);
    const files = await scanMarkdownFiles(inputDir);
    await assertMarkdownFilesExist(inputDir, files);
    await Promise.all(files.map(async (filePath) => {
        const content = await readTextFile(filePath);
        if (isIgnoredMarkdownFile(filePath)) {
            await writeMirroredFile(getOutputPath(outputDir, getRelativeMarkdownPath(inputDir, filePath)), content);
            return;
        }
        const document = normalizeMarkdownDocument({
            content,
            inputRoot: inputDir,
            outputRoot: outputDir,
            sourcePath: filePath,
        });
        await writeMirroredFile(document.outputPath, document.content);
    }));
}
//# sourceMappingURL=frontmatter.js.map