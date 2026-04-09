import type { WikilinkParts } from "../types.js";
export declare function parseWikilink(raw: string): WikilinkParts | null;
export declare function replaceWikilinks(content: string, replacer: (wikilink: WikilinkParts) => string): string;
