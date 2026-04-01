import { resolve, relative } from "path";
import { globby } from "globby";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";

export class FileFindTool extends BaseTool {
  name = "file_find";
  description =
    "Search for files by name or pattern within the project. Supports glob patterns (e.g., '**/*.ts', 'src/components/*.tsx'). Very efficient for locating specific files without reading their content.";
  parameters: ToolParameter[] = [
    {
      name: "pattern",
      type: "string",
      description: "The filename or glob pattern to search for (e.g., 'package.json', '**/*.test.ts')",
      required: true,
    },
    {
      name: "path",
      type: "string",
      description: "Directory to search in. Defaults to the current working directory.",
      required: false,
    },
    {
      name: "max_results",
      type: "number",
      description: "Maximum number of results to return. Default: 100.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const pattern = args.pattern as string;
    const searchPath = resolve(process.cwd(), (args.path as string) || ".");
    const maxResults = (args.max_results as number) || 100;

    try {
      // Use globby for efficient searching
      const matches = (await globby(pattern, {
        cwd: searchPath,
        absolute: true,
        onlyFiles: true,
        gitignore: true, // Respect .gitignore
      })) as any[];

      if (matches.length === 0) {
        return this.success(`No files found matching: "${pattern}" in ${searchPath}`);
      }

      // Limit results and normalize
      const limitedMatches = matches.slice(0, maxResults);

      // Convert absolute paths back to relative for user readability
      const relativeMatches = limitedMatches.map((match) => {
        const path = typeof match === "string" ? match : match.path;
        return relative(process.cwd(), path);
      });

      const output = relativeMatches.join("\n");
      return this.success(
        `📂 Found ${limitedMatches.length} file(s) matching "${pattern}":\n\n${output}`
      );
    } catch (err) {
      return this.failure(`File search failed: ${(err as Error).message}`);
    }
  }
}
