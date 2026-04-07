import type { WikilinkParts } from "../types.js";

const WIKILINK_PATTERN = /\[\[([^[\]]+?)\]\]/g;

export function parseWikilink(raw: string): WikilinkParts | null {
  const inner = raw.slice(2, -2).trim();
  if (!inner) {
    return null;
  }

  const [targetPart, aliasPart] = splitOnce(inner, "|");
  const [titlePart, anchorPart] = splitOnce(targetPart, "#");
  const targetTitle = titlePart.trim();

  if (!targetTitle) {
    return null;
  }

  const anchor = anchorPart?.trim() || undefined;
  const alias = aliasPart?.trim();

  const result: WikilinkParts = {
    raw,
    targetTitle,
    label: alias && alias.length > 0 ? alias : targetTitle,
  };

  if (anchor) {
    result.anchor = anchor;
  }

  return result;
}

export function replaceWikilinks(
  content: string,
  replacer: (wikilink: WikilinkParts) => string,
): string {
  return content.replace(WIKILINK_PATTERN, (raw) => {
    const parsed = parseWikilink(raw);
    return parsed ? replacer(parsed) : raw;
  });
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index === -1) {
    return [value, undefined];
  }

  return [value.slice(0, index), value.slice(index + separator.length)];
}
