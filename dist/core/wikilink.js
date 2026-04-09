const WIKILINK_PATTERN = /\[\[([^[\]]+?)\]\]/g;
export function parseWikilink(raw) {
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
    const result = {
        raw,
        targetTitle,
        label: alias && alias.length > 0 ? alias : targetTitle,
    };
    if (anchor) {
        result.anchor = anchor;
    }
    return result;
}
export function replaceWikilinks(content, replacer) {
    return content.replace(WIKILINK_PATTERN, (raw) => {
        const parsed = parseWikilink(raw);
        return parsed ? replacer(parsed) : raw;
    });
}
function splitOnce(value, separator) {
    const index = value.indexOf(separator);
    if (index === -1) {
        return [value, undefined];
    }
    return [value.slice(0, index), value.slice(index + separator.length)];
}
//# sourceMappingURL=wikilink.js.map