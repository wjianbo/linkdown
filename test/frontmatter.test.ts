import test from "node:test";
import assert from "node:assert/strict";

import { normalizeMarkdownDocument } from "../src/core/frontmatter.js";

const inputRoot = "/tmp/in";
const outputRoot = "/tmp/out";

test("adds front matter using the first h1 when missing", () => {
  const document = normalizeMarkdownDocument({
    content: "# Running\n\nBody\n",
    inputRoot,
    outputRoot,
    sourcePath: "/tmp/in/notes/running.md",
  });

  assert.equal(document.title, "Running");
  assert.equal(document.hadFrontmatter, false);
  assert.match(document.content, /^---\ntitle: "Running"\n---\n\n# Running/m);
});

test("falls back to the filename when there is no h1", () => {
  const document = normalizeMarkdownDocument({
    content: "Body only\n",
    inputRoot,
    outputRoot,
    sourcePath: "/tmp/in/notes/physics-laws.md",
  });

  assert.equal(document.title, "physics-laws");
  assert.match(document.content, /^---\ntitle: "physics-laws"\n---/);
});

test("preserves existing front matter and title", () => {
  const content = ["---", 'title: "运动三定律"', "aliases:", "  - 牛顿定律", "---", "", "# Ignored", ""].join("\n");

  const document = normalizeMarkdownDocument({
    content,
    inputRoot,
    outputRoot,
    sourcePath: "/tmp/in/notes/physics-laws.md",
  });

  assert.equal(document.hadFrontmatter, true);
  assert.equal(document.title, "运动三定律");
  assert.deepEqual(document.aliases, ["牛顿定律"]);
  assert.equal(document.content, content);
});
