import type { NormalizedDocument, ResolutionResult, WikilinkParts } from "../types.js";
export interface LinkIndex {
    resolve(link: WikilinkParts): ResolutionResult;
}
export declare function createLinkIndex(documents: NormalizedDocument[]): LinkIndex;
