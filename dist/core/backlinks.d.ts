export declare class BacklinksCollector {
    private readonly links;
    add(sourcePath: string, targetPath: string): void;
    toJSON(): Record<string, string[]>;
}
