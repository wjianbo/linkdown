import type { FrontmatterData, NormalizedDocument } from "../types.js";
interface FrontmatterSection {
    data: FrontmatterData;
    body: string;
    raw?: string;
    hadFrontmatter: boolean;
}
export declare function normalizeMarkdownDocument(args: {
    content: string;
    inputRoot: string;
    outputRoot: string;
    sourcePath: string;
    ensureFrontmatter?: boolean;
}): NormalizedDocument;
export declare function parseFrontmatter(content: string): FrontmatterSection;
export declare function updateFrontmatterSlug(content: string, slug: string): string;
export {};
