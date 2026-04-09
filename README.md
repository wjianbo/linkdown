# linkdown

`linkdown` is a minimal CLI for preparing Markdown content for Zola.

It does three things:

- ensures each Markdown file has front matter
- converts `[[wikilinks]]` into Zola `@/path/to/file.md` links
- renames files from front matter titles when you want slug-based filenames
- ignores Markdown files whose names start with `_`

## What

`linkdown` works on Markdown source files, not rendered site URLs.

The main command is:

```bash
linkdown build content --out build/output
```

That writes transformed Markdown plus three JSON reports:

- `backlinks.json`
- `unresolved.json`
- `ambiguous.json`

## Why

Zola resolves internal links from source content paths such as:

```md
[Motion](@/notes/physics-laws.md)
```

That is different from a final public URL. `linkdown` keeps the preprocessing boundary small:

- it ensures front matter exists
- it resolves wikilinks against Markdown titles and aliases
- it does not guess final site routing

## Installation

From this repository:

```bash
npm install
npm run build
npm install -g .
```

For local development:

```bash
npm link
```

After publishing to npm:

```bash
npm install -g linkdown
```

## Features

- Minimal CLI with three commands: `build`, `frontmatter`, `rename`
- Deterministic output with stable JSON report ordering
- Title and alias based wikilink resolution
- Dry-run rename workflow
- Slug generation for non-Latin titles through `pinyin`
- Consistent ignore rule for underscore-prefixed Markdown files such as `_index.md`

Supported wikilinks:

```md
[[Title]]
[[Title|Label]]
[[Title#Anchor]]
[[Title#Anchor|Label]]
```

Matching rules:

- match by front matter `title`
- also match by front matter `aliases`
- unresolved links stay unchanged and are written to `unresolved.json`
- ambiguous links stay unchanged and are written to `ambiguous.json`

## Usage

Install dependencies and build the CLI:

```bash
npm install
npm run build
```

Run help:

```bash
node dist/cli.js --help
```

For local development:

```bash
npm run dev -- --help
```

### `linkdown build`

Build normalized Markdown and reports:

```bash
linkdown build content --out build/output
```

Behavior:

1. Scan Markdown files under `<inputDir>`.
2. Ignore Markdown files whose names start with `_`, such as `_index.md`.
3. Ensure front matter exists.
4. Build a lookup from `title` and `aliases`.
5. Convert supported wikilinks to Zola `@/` links.
6. Write transformed Markdown and JSON reports to `<outputDir>`.

Example:

```md
[[运动三定律#第二定律|牛顿定律]]
```

becomes:

```md
[牛顿定律](@/notes/physics-laws.md#第二定律)
```

### `linkdown frontmatter`

Write Markdown with ensured front matter:

```bash
linkdown frontmatter content --out build/frontmatter
```

Title priority:

1. existing front matter `title`
2. first Markdown H1
3. filename without extension

If front matter is missing, `linkdown` writes:

```yaml
---
title: "Example"
---
```

Files such as `_index.md` are ignored.

### `linkdown rename`

Rename Markdown files in place from front matter titles:

```bash
linkdown rename content
linkdown rename content --write
```

Behavior:

- dry run by default
- keeps files in the same directory
- adds `slug` only when front matter exists and `slug` is missing
- preserves existing `slug`
- appends `-2`, `-3`, and so on for duplicate names in one directory
- ignores Markdown files whose names start with `_`, such as `_index.md`
- does not rewrite Markdown links

Example:

```yaml
---
title: "无人知晓"
---
```

becomes:

`wu-ren-zhi-xiao.md`
