export class BacklinksCollector {
    links = new Map();
    add(sourcePath, targetPath) {
        const sources = this.links.get(targetPath) ?? new Set();
        sources.add(sourcePath);
        this.links.set(targetPath, sources);
    }
    toJSON() {
        return Object.fromEntries([...this.links.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([target, sources]) => [target, [...sources].sort((left, right) => left.localeCompare(right))]));
    }
}
//# sourceMappingURL=backlinks.js.map