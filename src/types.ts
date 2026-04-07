export interface FrontmatterData {
  title?: string;
  slug?: string;
  aliases: string[];
}

export interface NormalizedDocument {
  sourcePath: string;
  relativePath: string;
  outputPath: string;
  content: string;
  title: string;
  aliases: string[];
  frontmatter: FrontmatterData;
  hadFrontmatter: boolean;
}

export interface WikilinkParts {
  raw: string;
  targetTitle: string;
  anchor?: string;
  label: string;
}

export interface ResolutionSuccess {
  kind: "resolved";
  targetPath: string;
  markdown: string;
}

export interface ResolutionFailure {
  kind: "unresolved" | "ambiguous";
  requestedTitle: string;
}

export type ResolutionResult = ResolutionSuccess | ResolutionFailure;

export interface BuildReports {
  unresolved: Record<string, string[]>;
  ambiguous: Record<string, string[]>;
  backlinks: Record<string, string[]>;
}
