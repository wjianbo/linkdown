import { pinyin } from "pinyin";
const VALID_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function slugifyTitle(title) {
    const segments = pinyin(title, { style: "normal" }).map(([value]) => value ?? "");
    const raw = segments.join(" ");
    return raw
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
}
export function isValidSlug(value) {
    return VALID_SLUG_PATTERN.test(value);
}
//# sourceMappingURL=slug.js.map