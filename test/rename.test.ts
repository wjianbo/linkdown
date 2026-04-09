import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("rename dry run reports planned rename and does not modify files", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "input");
  const sourcePath = path.join(inputDir, "notes", "A Perfect Day.md");
  const originalContent = ['---', 'title: "A Perfect Day"', "---", "", "Body", ""].join("\n");

  try {
    await mkdirRecursive(path.dirname(sourcePath));
    await writeFile(sourcePath, originalContent, "utf8");

    const result = await execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "rename", inputDir], {
      cwd: path.resolve(process.cwd()),
    });

    assert.match(result.stdout, /notes\/A Perfect Day\.md -> notes\/a-perfect-day\.md/);
    assert.match(result.stdout, /Dry run only/);
    assert.equal(await readFile(sourcePath, "utf8"), originalContent);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("rename --write renames files, preserves existing slugs, and skips valid slug filenames and missing titles", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "input");

  const englishPath = path.join(inputDir, "notes", "A Perfect Day.md");
  const chinesePath = path.join(inputDir, "notes", "无人知晓.md");
  const duplicateOnePath = path.join(inputDir, "other", "First Copy.md");
  const duplicateTwoPath = path.join(inputDir, "other", "Second Copy.md");
  const occupiedPath = path.join(inputDir, "other", "same-name.md");
  const noTitlePath = path.join(inputDir, "other", "Untitled File.md");
  const noOpPath = path.join(inputDir, "notes", "already-good.md");

  try {
    await mkdirRecursive(path.dirname(englishPath));
    await mkdirRecursive(path.dirname(duplicateOnePath));

    await writeFile(englishPath, ['---', 'title: "A Perfect Day"', "---", "", "Body", ""].join("\n"), "utf8");
    await writeFile(chinesePath, ['---', 'title: "无人知晓"', 'slug: "old-slug"', "---", "", "Body", ""].join("\n"), "utf8");
    await writeFile(duplicateOnePath, ['---', 'title: "Same Name"', "---", "", "Body", ""].join("\n"), "utf8");
    await writeFile(duplicateTwoPath, ['---', 'title: "Same Name"', "---", "", "Body", ""].join("\n"), "utf8");
    await writeFile(occupiedPath, ["Existing occupant", ""].join("\n"), "utf8");
    await writeFile(noTitlePath, ["Body only", ""].join("\n"), "utf8");
    await writeFile(noOpPath, ['---', 'title: "already good"', "---", "", "Body", ""].join("\n"), "utf8");

    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", "rename", inputDir, "--write"],
      {
        cwd: path.resolve(process.cwd()),
      },
    );

    assert.match(result.stdout, /notes\/A Perfect Day\.md -> notes\/a-perfect-day\.md/);
    assert.match(result.stdout, /notes\/无人知晓\.md -> notes\/wu-ren-zhi-xiao\.md/);
    assert.match(result.stdout, /other\/First Copy\.md -> other\/same-name-2\.md/);
    assert.match(result.stdout, /other\/Second Copy\.md -> other\/same-name-3\.md/);
    assert.match(result.stdout, /other\/same-name\.md skipped \(filename already slugified\)/);
    assert.match(result.stdout, /other\/Untitled File\.md skipped \(missing front matter title\)/);
    assert.match(result.stdout, /notes\/already-good\.md skipped \(filename already slugified\)/);

    const englishRenamedPath = path.join(inputDir, "notes", "a-perfect-day.md");
    const chineseRenamedPath = path.join(inputDir, "notes", "wu-ren-zhi-xiao.md");
    const duplicateOneRenamedPath = path.join(inputDir, "other", "same-name-2.md");
    const duplicateTwoRenamedPath = path.join(inputDir, "other", "same-name-3.md");

    await access(englishRenamedPath);
    await access(chineseRenamedPath);
    await access(duplicateOneRenamedPath);
    await access(duplicateTwoRenamedPath);
    await access(occupiedPath);
    await access(noTitlePath);
    await access(noOpPath);

    const englishContent = await readFile(englishRenamedPath, "utf8");
    const chineseContent = await readFile(chineseRenamedPath, "utf8");
    const noOpContent = await readFile(noOpPath, "utf8");

    assert.match(englishContent, /^---\ntitle: "A Perfect Day"\nslug: "a-perfect-day"\n---/m);
    assert.match(chineseContent, /^---\ntitle: "无人知晓"\nslug: "old-slug"\n---/m);
    assert.doesNotMatch(noOpContent, /\nslug:\s*"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("rename ignores markdown files whose names start with an underscore", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "input");
  const ignoredPath = path.join(inputDir, "notes", "_index.md");
  const sourcePath = path.join(inputDir, "notes", "A Perfect Day.md");

  try {
    await mkdirRecursive(path.dirname(sourcePath));
    await writeFile(ignoredPath, ['---', 'title: "Notes Index"', "---", "", "Body", ""].join("\n"), "utf8");
    await writeFile(sourcePath, ['---', 'title: "A Perfect Day"', "---", "", "Body", ""].join("\n"), "utf8");

    const result = await execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "rename", inputDir], {
      cwd: path.resolve(process.cwd()),
    });

    assert.match(result.stdout, /notes\/A Perfect Day\.md -> notes\/a-perfect-day\.md/);
    assert.doesNotMatch(result.stdout, /_index\.md/);
    assert.equal(await readFile(ignoredPath, "utf8"), ['---', 'title: "Notes Index"', "---", "", "Body", ""].join("\n"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function mkdirRecursive(targetDir: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(targetDir, { recursive: true });
}
