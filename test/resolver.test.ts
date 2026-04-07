import test from "node:test";
import assert from "node:assert/strict";

import { createLinkIndex } from "../src/core/resolver.js";
import type { NormalizedDocument } from "../src/types.js";

function createDocument(relativePath: string, title: string, aliases: string[] = []): NormalizedDocument {
  return {
    sourcePath: `/tmp/in/${relativePath}`,
    relativePath,
    outputPath: `/tmp/out/${relativePath}`,
    content: "",
    title,
    aliases,
    frontmatter: { title, aliases },
    hadFrontmatter: true,
  };
}

test("resolves a canonical title", () => {
  const index = createLinkIndex([createDocument("notes/physics-laws.md", "运动三定律")]);
  const resolved = index.resolve({
    raw: "[[运动三定律]]",
    targetTitle: "运动三定律",
    label: "运动三定律",
  });

  assert.deepEqual(resolved, {
    kind: "resolved",
    targetPath: "notes/physics-laws.md",
    markdown: "[运动三定律](@/notes/physics-laws.md)",
  });
});

test("resolves an alias to the same target", () => {
  const index = createLinkIndex([createDocument("notes/physics-laws.md", "运动三定律", ["牛顿定律"])]);
  const resolved = index.resolve({
    raw: "[[牛顿定律]]",
    targetTitle: "牛顿定律",
    label: "牛顿定律",
  });

  assert.deepEqual(resolved, {
    kind: "resolved",
    targetPath: "notes/physics-laws.md",
    markdown: "[牛顿定律](@/notes/physics-laws.md)",
  });
});

test("reports unresolved titles", () => {
  const index = createLinkIndex([createDocument("notes/physics-laws.md", "运动三定律")]);
  const resolved = index.resolve({
    raw: "[[missing]]",
    targetTitle: "missing",
    label: "missing",
  });

  assert.deepEqual(resolved, {
    kind: "unresolved",
    requestedTitle: "missing",
  });
});

test("reports ambiguous titles", () => {
  const index = createLinkIndex([
    createDocument("notes/physics-laws.md", "重复"),
    createDocument("other/duplicate.md", "重复"),
  ]);
  const resolved = index.resolve({
    raw: "[[重复]]",
    targetTitle: "重复",
    label: "重复",
  });

  assert.deepEqual(resolved, {
    kind: "ambiguous",
    requestedTitle: "重复",
  });
});
