#!/usr/bin/env node
import { Command } from "commander";
import { runBuildCommand } from "./commands/build.js";
import { runFrontmatterCommand } from "./commands/frontmatter.js";
import { runRenameCommand } from "./commands/rename.js";
const program = new Command();
program
    .name("linkdown")
    .description("Prepare Markdown content for Zola by ensuring front matter and resolving wikilinks.")
    .showSuggestionAfterError()
    .showHelpAfterError()
    .addHelpText("after", `
Examples:
  linkdown frontmatter content --out out
  linkdown build content --out out
  linkdown rename content
`);
program
    .command("frontmatter")
    .summary("Ensure front matter and write normalized Markdown to an output directory.")
    .description("Read Markdown files from <inputDir>, ensure each file has front matter, and write the result to --out.")
    .argument("<inputDir>", "directory containing markdown files")
    .requiredOption("--out <outputDir>", "directory to write transformed markdown files to")
    .addHelpText("after", `
Example:
  linkdown frontmatter content --out build/frontmatter
`)
    .action(async (inputDir, options) => {
    await runFrontmatterCommand(inputDir, options.out);
});
program
    .command("build")
    .summary("Build normalized Markdown plus JSON reports.")
    .description("Read Markdown files from <inputDir>, ensure front matter, resolve wikilinks, and write Markdown plus reports to --out.")
    .argument("<inputDir>", "directory containing markdown files")
    .requiredOption("--out <outputDir>", "directory to write transformed markdown files to")
    .addHelpText("after", `
Reports:
  backlinks.json
  unresolved.json
  ambiguous.json

Example:
  linkdown build content --out build/output
`)
    .action(async (inputDir, options) => {
    await runBuildCommand(inputDir, options.out);
});
program
    .command("rename")
    .summary("Rename Markdown files from front matter titles.")
    .description("Read Markdown files in <inputDir>, derive slug-based filenames from front matter titles, and update missing slug fields. Dry run by default.")
    .argument("<inputDir>", "directory containing markdown files")
    .option("--write", "apply file renames and front matter slug updates in place")
    .addHelpText("after", `
Examples:
  linkdown rename content
  linkdown rename content --write
`)
    .action(async (inputDir, options) => {
    await runRenameCommand(inputDir, Boolean(options.write));
});
try {
    await program.parseAsync(process.argv);
}
catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`linkdown: ${message}`);
    process.exitCode = 1;
}
//# sourceMappingURL=cli.js.map