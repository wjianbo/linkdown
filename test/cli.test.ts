import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("build command transforms links and emits reports", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "input");
  const outputDir = path.join(tempRoot, "output");

  try {
    await writeFile(
      path.join(inputDir, "notes", "physics-laws.md"),
      ['---', 'title: "运动三定律"', "aliases:", "  - 牛顿定律", "---", "", "Body", ""].join("\n"),
      { encoding: "utf8", flag: "wx" },
    ).catch(async () => {
      await mkdirRecursive(path.join(inputDir, "notes"));
      await writeFile(
        path.join(inputDir, "notes", "physics-laws.md"),
        ['---', 'title: "运动三定律"', "aliases:", "  - 牛顿定律", "---", "", "Body", ""].join("\n"),
        "utf8",
      );
    });

    await mkdirRecursive(path.join(inputDir, "notes"));
    await writeFile(
      path.join(inputDir, "notes", "training.md"),
      ["# Training", "", "[[运动三定律]]", "[[牛顿定律|早餐]]", "[[缺失条目]]", ""].join("\n"),
      "utf8",
    );

    await execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "build", inputDir, "--out", outputDir], {
      cwd: path.resolve(process.cwd()),
    });

    const output = await readFile(path.join(outputDir, "notes", "training.md"), "utf8");
    const unresolved = JSON.parse(await readFile(path.join(outputDir, "unresolved.json"), "utf8")) as Record<
      string,
      string[]
    >;
    const backlinks = JSON.parse(await readFile(path.join(outputDir, "backlinks.json"), "utf8")) as Record<
      string,
      string[]
    >;

    assert.match(output, /\[运动三定律\]\(@\/notes\/physics-laws\.md\)/);
    assert.match(output, /\[早餐\]\(@\/notes\/physics-laws\.md\)/);
    assert.match(output, /\[\[缺失条目\]\]/);
    assert.deepEqual(unresolved, {
      "notes/training.md": ["缺失条目"],
    });
    assert.deepEqual(backlinks, {
      "notes/physics-laws.md": ["notes/training.md"],
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("build command reports missing input directories clearly", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const missingInputDir = path.join(tempRoot, "missing");
  const outputDir = path.join(tempRoot, "output");

  try {
    await assert.rejects(
      execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "build", missingInputDir, "--out", outputDir], {
        cwd: path.resolve(process.cwd()),
      }),
      (error: unknown) => {
        assert.match(String(error), /linkdown: Input directory not found:/);
        return true;
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("build command processes underscore-prefixed markdown files", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "input");
  const outputDir = path.join(tempRoot, "output");
  const indexContent = ["# Index", "", "[[运动三定律]]", ""].join("\n");

  try {
    await mkdirRecursive(path.join(inputDir, "notes"));
    await writeFile(
      path.join(inputDir, "notes", "physics-laws.md"),
      ['---', 'title: "运动三定律"', "---", "", "Body", ""].join("\n"),
      "utf8",
    );
    await writeFile(path.join(inputDir, "notes", "_index.md"), indexContent, "utf8");

    await execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "build", inputDir, "--out", outputDir], {
      cwd: path.resolve(process.cwd()),
    });

    const builtIndex = await readFile(path.join(outputDir, "notes", "_index.md"), "utf8");
    assert.doesNotMatch(builtIndex, /^---\n/);
    assert.match(builtIndex, /\[运动三定律\]\(@\/notes\/physics-laws\.md\)/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("frontmatter command rejects overlapping input and output directories", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "content");
  const outputDir = path.join(inputDir, "build");

  try {
    await mkdirRecursive(inputDir);
    await writeFile(path.join(inputDir, "note.md"), "# Note\n", "utf8");

    await assert.rejects(
      execFileAsync(
        process.execPath,
        ["--import", "tsx", "src/cli.ts", "frontmatter", inputDir, "--out", outputDir],
        {
          cwd: path.resolve(process.cwd()),
        },
      ),
      (error: unknown) => {
        assert.match(String(error), /linkdown: Input and output directories must not overlap\./);
        return true;
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("frontmatter command copies underscore-prefixed markdown files without adding front matter", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "linkdown-"));
  const inputDir = path.join(tempRoot, "content");
  const outputDir = path.join(tempRoot, "output");
  const indexContent = ["# Index", "", "Body", ""].join("\n");

  try {
    await mkdirRecursive(inputDir);
    await writeFile(path.join(inputDir, "_index.md"), indexContent, "utf8");

    await execFileAsync(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", "frontmatter", inputDir, "--out", outputDir],
      {
        cwd: path.resolve(process.cwd()),
      },
    );

    const copiedIndex = await readFile(path.join(outputDir, "_index.md"), "utf8");
    assert.equal(copiedIndex, indexContent);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function mkdirRecursive(targetDir: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(targetDir, { recursive: true });
}
