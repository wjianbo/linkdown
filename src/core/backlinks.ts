export class BacklinksCollector {
  private readonly links = new Map<string, Set<string>>();

  add(sourcePath: string, targetPath: string): void {
    const sources = this.links.get(targetPath) ?? new Set<string>();
    sources.add(sourcePath);
    this.links.set(targetPath, sources);
  }

  toJSON(): Record<string, string[]> {
    return Object.fromEntries(
      [...this.links.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([target, sources]) => [target, [...sources].sort((left, right) => left.localeCompare(right))]),
    );
  }
}
