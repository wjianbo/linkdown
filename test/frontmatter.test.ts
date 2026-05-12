import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { normalizeMarkdownDocument, resolveFrontmatterDate } from "../src/core/frontmatter.js";

const inputRoot = "/tmp/in";
const outputRoot = "/tmp/out";
const execFileAsync = promisify(execFile);

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

test("adds a normalized date from supported filename formats", () => {
  const filenames = ["2026-05-12.md", "2026.05.12.md", "20260512.md", "2026_05_12.md"];

  for (const filename of filenames) {
    const document = normalizeMarkdownDocument({
      content: "# Entry\n\nBody\n",
      inputRoot,
      outputRoot,
      sourcePath: `/tmp/in/notes/${filename}`,
    });

    assert.match(document.content, /^---\ntitle: "Entry"\ndate: 2026-05-12\n---/);
  }
});

test("adds a missing date to existing front matter without changing the title", () => {
  const content = ["---", 'title: "Entry"', "---", "", "Body", ""].join("\n");

  const document = normalizeMarkdownDocument({
    content,
    inputRoot,
    outputRoot,
    sourcePath: "/tmp/in/notes/2026_05_12.md",
  });

  assert.match(document.content, /^---\ntitle: "Entry"\ndate: 2026-05-12\n---\n\nBody/m);
});

test("does not overwrite an existing front matter date", () => {
  const content = ["---", 'title: "Entry"', "date: 1999-01-01", "---", "", "Body", ""].join("\n");

  const document = normalizeMarkdownDocument({
    content,
    inputRoot,
    outputRoot,
    sourcePath: "/tmp/in/notes/2026-05-12.md",
  });

  assert.equal(document.content, content);
});

test("resolves a missing date from the git first commit date when the filename has no date", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const sourcePath = path.join(tempRoot, "notes", "entry.md");
  const content = "# Entry\n\nBody\n";

  try {
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, content, "utf8");
    await execFileAsync("git", ["init"], { cwd: tempRoot });
    await execFileAsync("git", ["add", "notes/entry.md"], { cwd: tempRoot });
    await execFileAsync("git", ["commit", "-m", "add entry"], {
      cwd: tempRoot,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Linkdown Test",
        GIT_AUTHOR_EMAIL: "linkdown@example.com",
        GIT_AUTHOR_DATE: "2024-03-02T01:02:03+09:00",
        GIT_COMMITTER_NAME: "Linkdown Test",
        GIT_COMMITTER_EMAIL: "linkdown@example.com",
        GIT_COMMITTER_DATE: "2024-03-02T01:02:03+09:00",
      },
    });

    const frontmatterDate = await resolveFrontmatterDate({ content, sourcePath });
    const document = normalizeMarkdownDocument({
      content,
      inputRoot: tempRoot,
      outputRoot,
      sourcePath,
      frontmatterDate,
    });

    assert.equal(frontmatterDate, "2024-03-02");
    assert.match(document.content, /^---\ntitle: "Entry"\ndate: 2024-03-02\n---/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("falls back to filesystem creation time when filename and git date are unavailable", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const sourcePath = path.join(tempRoot, "entry.md");
  const content = "# Entry\n\nBody\n";

  try {
    await writeFile(sourcePath, content, "utf8");
    const stats = await stat(sourcePath);
    const expectedDate = formatLocalDate(stats.birthtime);
    const frontmatterDate = await resolveFrontmatterDate({ content, sourcePath });

    assert.equal(frontmatterDate, expectedDate);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

function formatLocalDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
