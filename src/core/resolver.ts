import type { NormalizedDocument, ResolutionResult, WikilinkParts } from "../types.js";

export interface LinkIndex {
  resolve(link: WikilinkParts): ResolutionResult;
}

export function createLinkIndex(documents: NormalizedDocument[]): LinkIndex {
  const lookup = new Map<string, Set<string>>();

  for (const document of documents) {
    addLookupValue(lookup, document.title, document.relativePath);
    for (const alias of document.aliases) {
      addLookupValue(lookup, alias, document.relativePath);
    }
  }

  return {
    resolve(link) {
      const candidates = [...(lookup.get(link.targetTitle) ?? new Set<string>())].sort((left, right) =>
        left.localeCompare(right),
      );

      if (candidates.length === 0) {
        return {
          kind: "unresolved",
          requestedTitle: link.targetTitle,
        };
      }

      if (candidates.length > 1) {
        return {
          kind: "ambiguous",
          requestedTitle: link.targetTitle,
        };
      }

      const targetPath = candidates[0];
      if (!targetPath) {
        return {
          kind: "unresolved",
          requestedTitle: link.targetTitle,
        };
      }

      const suffix = link.anchor ? `#${link.anchor}` : "";

      return {
        kind: "resolved",
        targetPath,
        markdown: `[${link.label}](@/${targetPath}${suffix})`,
      };
    },
  };
}

function addLookupValue(lookup: Map<string, Set<string>>, key: string, relativePath: string): void {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return;
  }

  const candidates = lookup.get(normalizedKey) ?? new Set<string>();
  candidates.add(relativePath);
  lookup.set(normalizedKey, candidates);
}
