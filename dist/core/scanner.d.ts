export declare function toUnixPath(value: string): string;
export declare function scanMarkdownFiles(inputDir: string): Promise<string[]>;
export declare function isIgnoredMarkdownFile(filePath: string): boolean;
export declare function assertMarkdownFilesExist(inputDir: string, files: string[]): Promise<void>;
export declare function assertPathPairIsSafe(inputDir: string, outputDir: string): void;
export declare function getRelativeMarkdownPath(rootDir: string, filePath: string): string;
export declare function getOutputPath(outputDir: string, relativePath: string): string;
export declare function readTextFile(filePath: string): Promise<string>;
export declare function writeMirroredFile(outputPath: string, content: string): Promise<void>;
