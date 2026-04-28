import { readdir, stat } from "fs/promises";
import { resolve, relative } from "path";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { checkKodaIgnore } from "../utils/kodaignore.js";

export class ListDirTool extends BaseTool {
  name = "list_dir";
  description =
    "List the contents of a directory, showing files and subdirectories with their sizes and types.";
  parameters: ToolParameter[] = [
    {
      name: "path",
      type: "string",
      description:
        "Path to the directory to list. Defaults to current directory.",
      required: false,
    },
    {
      name: "recursive",
      type: "boolean",
      description:
        "Whether to list recursively. Default: false. Max depth: 3.",
      required: false,
    },
    {
      name: "show_hidden",
      type: "boolean",
      description: "Whether to show hidden files (starting with .). Default: false.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = resolve(
      process.cwd(),
      (args.path as string) || "."
    );
    const recursive = (args.recursive as boolean) || false;
    const showHidden = (args.show_hidden as boolean) || false;
    const maxDepth = recursive ? 3 : 1;

    try {
      const entries: string[] = [];
      await this.listEntries(dirPath, dirPath, entries, showHidden, 0, maxDepth);

      if (entries.length === 0) {
        return this.success(`📂 ${dirPath} (empty directory)`);
      }

      const header = `📂 ${dirPath} (${entries.length} entries)`;
      return this.success(`${header}\n\n${entries.join("\n")}`);
    } catch (err) {
      return this.failure(
        `Failed to list directory: ${(err as Error).message}`
      );
    }
  }

  private async listEntries(
    basePath: string,
    currentPath: string,
    entries: string[],
    showHidden: boolean,
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth >= maxDepth || entries.length > 500) return;

    const ignorePatterns = [
      "node_modules",
      ".git",
      "dist",
      ".next",
      "__pycache__",
      ".venv",
    ];

    const items = await readdir(currentPath, { withFileTypes: true });

    // Sort: directories first, then files
    const sorted = items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of sorted) {
      if (!showHidden && item.name.startsWith(".")) continue;
      if (ignorePatterns.includes(item.name)) continue;
      if (entries.length > 500) break;

      const fullPath = resolve(currentPath, item.name);
      const relPath = relative(basePath, fullPath);

      // Verifica .kodaignore
      if (checkKodaIgnore(relPath)) continue;
      const indent = "  ".repeat(depth);

      if (item.isDirectory()) {
        entries.push(`${indent}📁 ${relPath}/`);
        if (depth < maxDepth - 1) {
          await this.listEntries(
            basePath,
            fullPath,
            entries,
            showHidden,
            depth + 1,
            maxDepth
          );
        }
      } else {
        try {
          const fileStat = await stat(fullPath);
          const size = this.formatSize(fileStat.size);
          entries.push(`${indent}📄 ${relPath} (${size})`);
        } catch {
          entries.push(`${indent}📄 ${relPath}`);
        }
      }
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
