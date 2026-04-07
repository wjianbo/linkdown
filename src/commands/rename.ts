import { readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter, updateFrontmatterSlug } from "../core/frontmatter.js";
import { assertMarkdownFilesExist, getRelativeMarkdownPath, readTextFile, scanMarkdownFiles } from "../core/scanner.js";
import { isValidSlug, slugifyTitle } from "../core/slug.js";

interface RenamePlanEntry {
  sourcePath: string;
  sourceRelativePath: string;
  sourceBasename: string;
  targetPath: string;
  targetRelativePath: string;
  targetBasename: string;
  updatedContent: string;
  renameRequired: boolean;
  contentUpdateRequired: boolean;
  skipReason?: string;
}

export async function runRenameCommand(inputDir: string, write: boolean): Promise<void> {
  const root = path.resolve(inputDir);
  const files = await scanMarkdownFiles(root);
  await assertMarkdownFilesExist(root, files);
  const occupiedNamesByDir = await getOccupiedNamesByDir(files);
  const reservedTargetsByDir = new Map<string, Set<string>>();
  const plans: RenamePlanEntry[] = [];

  for (const filePath of files) {
    const content = await readTextFile(filePath);
    const relativePath = getRelativeMarkdownPath(root, filePath);
    const sourceBasename = path.basename(filePath);
    const currentStem = path.basename(sourceBasename, ".md");

    if (isValidSlug(currentStem)) {
      plans.push(createSkippedPlan(filePath, relativePath, "skipped (filename already slugified)"));
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    const title = frontmatter.hadFrontmatter ? frontmatter.data.title?.trim() : undefined;

    if (!title) {
      plans.push(createSkippedPlan(filePath, relativePath, "skipped (missing front matter title)"));
      continue;
    }

    const baseSlug = slugifyTitle(title);
    if (!baseSlug) {
      plans.push(createSkippedPlan(filePath, relativePath, "skipped (empty slug from title)"));
      continue;
    }

    const directoryPath = path.dirname(filePath);
    const occupiedNames = occupiedNamesByDir.get(directoryPath) ?? new Set<string>();
    const reservedTargets = reservedTargetsByDir.get(directoryPath) ?? new Set<string>();
    reservedTargetsByDir.set(directoryPath, reservedTargets);

    const targetBasename = allocateTargetBasename(baseSlug, sourceBasename, occupiedNames, reservedTargets);
    const targetPath = path.join(directoryPath, targetBasename);
    const targetRelativePath = getRelativeMarkdownPath(root, targetPath);
    const updatedContent = updateFrontmatterSlug(content, path.basename(targetBasename, ".md"));
    const renameRequired = sourceBasename !== targetBasename;
    const contentUpdateRequired = updatedContent !== content;

    reservedTargets.add(targetBasename);

    plans.push({
      sourcePath: filePath,
      sourceRelativePath: relativePath,
      sourceBasename,
      targetPath,
      targetRelativePath,
      targetBasename,
      updatedContent,
      renameRequired,
      contentUpdateRequired,
    });
  }

  logPlan(plans, write);

  if (write) {
    await applyRenamePlan(plans);
  }

  const plannedRenames = plans.filter((plan) => plan.renameRequired).length;
  const updatedFrontmatter = plans.filter((plan) => plan.contentUpdateRequired).length;
  const skipped = plans.filter((plan) => plan.skipReason).length;

  console.log(
    `${write ? "Applied" : "Planned"} ${plannedRenames} rename(s), ` +
      `${write ? "updated" : "would update"} ${updatedFrontmatter} front matter file(s), ${skipped} skipped.`,
  );
}

function createSkippedPlan(sourcePath: string, sourceRelativePath: string, reason: string): RenamePlanEntry {
  return {
    sourcePath,
    sourceRelativePath,
    sourceBasename: path.basename(sourcePath),
    targetPath: sourcePath,
    targetRelativePath: sourceRelativePath,
    targetBasename: path.basename(sourcePath),
    updatedContent: "",
    renameRequired: false,
    contentUpdateRequired: false,
    skipReason: reason,
  };
}

async function getOccupiedNamesByDir(files: string[]): Promise<Map<string, Set<string>>> {
  const directories = [...new Set(files.map((filePath) => path.dirname(filePath)))];
  const entries = await Promise.all(
    directories.map(async (directoryPath) => {
      const names = await readdir(directoryPath);
      return [directoryPath, new Set(names)] as const;
    }),
  );

  return new Map(entries);
}

function allocateTargetBasename(
  baseSlug: string,
  sourceBasename: string,
  occupiedNames: Set<string>,
  reservedTargets: Set<string>,
): string {
  let attempt = 1;

  while (true) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const candidate = `${baseSlug}${suffix}.md`;
    const occupiedByOtherFile = occupiedNames.has(candidate) && candidate !== sourceBasename;
    const alreadyReserved = reservedTargets.has(candidate);

    if (!occupiedByOtherFile && !alreadyReserved) {
      return candidate;
    }

    attempt += 1;
  }
}

function logPlan(plans: RenamePlanEntry[], write: boolean): void {
  for (const plan of plans) {
    if (plan.skipReason) {
      console.log(`${plan.sourceRelativePath} ${plan.skipReason}`);
      continue;
    }

    if (plan.renameRequired) {
      console.log(`${plan.sourceRelativePath} -> ${plan.targetRelativePath}`);
      continue;
    }

    if (plan.contentUpdateRequired) {
      console.log(`${plan.sourceRelativePath} front matter slug updated`);
      continue;
    }

    console.log(`${plan.sourceRelativePath} skipped (already normalized)`);
  }

  if (!write) {
    console.log("");
    console.log("Dry run only. Re-run with --write to apply changes.");
  }
}

async function applyRenamePlan(plans: RenamePlanEntry[]): Promise<void> {
  const actionablePlans = plans.filter((plan) => !plan.skipReason && (plan.renameRequired || plan.contentUpdateRequired));

  for (const plan of actionablePlans) {
    if (plan.contentUpdateRequired) {
      await writeFile(plan.sourcePath, plan.updatedContent, "utf8");
    }
  }

  const tempMoves = await Promise.all(
    actionablePlans
      .filter((plan) => plan.renameRequired)
      .map(async (plan, index) => {
        const temporaryPath = path.join(path.dirname(plan.sourcePath), `${plan.sourceBasename}.linkdown-rename-${index}.tmp`);
        await rename(plan.sourcePath, temporaryPath);
        return { plan, temporaryPath };
      }),
  );

  await Promise.all(tempMoves.map(({ plan, temporaryPath }) => rename(temporaryPath, plan.targetPath)));
}
