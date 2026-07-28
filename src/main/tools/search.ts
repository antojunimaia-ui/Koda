import { exec } from "child_process";
import { resolve } from "path";
import { readdir, readFile, stat } from "fs/promises";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { checkKodaIgnore } from "../utils/kodaignore.js";

export class SearchTool extends BaseTool {
  name = "search";
  description =
    "Search for a pattern in files within a directory. Uses grep-like matching. Returns matching lines with file paths and line numbers.";
  parameters: ToolParameter[] = [
    {
      name: "pattern",
      type: "string",
      description: "The search pattern (supports regex)",
      required: true,
    },
    {
      name: "path",
      type: "string",
      description:
        "Directory or file to search in. Defaults to current directory.",
      required: false,
    },
    {
      name: "include",
      type: "string",
      description: 'File glob pattern to include (e.g., "*.ts", "*.py")',
      required: false,
    },
    {
      name: "case_insensitive",
      type: "boolean",
      description: "Whether to search case-insensitively. Default: false.",
      required: false,
    },
    {
      name: "max_results",
      type: "number",
      description: "Maximum number of results to return. Default: 50.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const pattern = args.pattern as string;
    const searchPath = resolve(
      (args.__cwd as string) ?? process.cwd(),
      (args.path as string) || "."
    );
    const include = args.include as string | undefined;
    const caseInsensitive = (args.case_insensitive as boolean) || false;
    const maxResults = (args.max_results as number) || 50;

    try {
      // Try using ripgrep first, fall back to manual search
      const results = await this.ripgrepSearch(
        pattern,
        searchPath,
        include,
        caseInsensitive,
        maxResults
      ).catch(() =>
        this.manualSearch(
          pattern,
          searchPath,
          include,
          caseInsensitive,
          maxResults
        )
      );

      if (!results || results.length === 0) {
        return this.success(`No matches found for pattern: "${pattern}"`);
      }

      // Filtra resultados de arquivos bloqueados pelo .kodaignore
      const filtered = results.filter(line => {
        const filePart = line.split(':')[0]
        return !checkKodaIgnore(filePart)
      })

      if (filtered.length === 0) {
        return this.success(`No matches found for pattern: "${pattern}"`);
      }

      const output = filtered.join("\n");
      return this.success(
        `🔍 Found ${filtered.length} match(es) for "${pattern}":\n\n${output}`
      );
    } catch (err) {
      return this.failure(`Search failed: ${(err as Error).message}`);
    }
  }

  private async ripgrepSearch(
    pattern: string,
    path: string,
    include: string | undefined,
    caseInsensitive: boolean,
    maxResults: number
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      let cmd = `rg --no-heading --line-number --max-count ${maxResults}`;
      if (caseInsensitive) cmd += " -i";
      if (include) cmd += ` --glob "${include}"`;
      cmd += ` "${pattern}" "${path}"`;

      exec(cmd, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout) => {
        if (error && !stdout) {
          reject(error);
          return;
        }
        const lines = stdout
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        resolve(lines.slice(0, maxResults));
      });
    });
  }

  private async manualSearch(
    pattern: string,
    searchPath: string,
    include: string | undefined,
    caseInsensitive: boolean,
    maxResults: number
  ): Promise<string[]> {
    const results: string[] = [];
    const regex = new RegExp(pattern, caseInsensitive ? "gi" : "g");

    const files = await this.getFiles(searchPath, include);

    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const content = await readFile(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          if (regex.test(lines[i])) {
            results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
          }
          regex.lastIndex = 0; // Reset regex state
        }
      } catch {
        // Skip binary or unreadable files
      }
    }

    return results;
  }

  private async getFiles(
    dir: string,
    include?: string
  ): Promise<string[]> {
    const files: string[] = [];
    const ignorePatterns = [
      "node_modules",
      ".git",
      "dist",
      ".next",
      "__pycache__",
      ".venv",
      "venv",
    ];

    const walk = async (currentPath: string, depth = 0) => {
      if (depth > 10 || files.length > 5000) return;

      try {
        const items = await readdir(currentPath, { withFileTypes: true });
        for (const item of items) {
          const fullPath = resolve(currentPath, item.name);

          if (
            item.isDirectory() &&
            !ignorePatterns.includes(item.name)
          ) {
            await walk(fullPath, depth + 1);
          } else if (item.isFile()) {
            if (include) {
              const globPattern = include.replace("*.", "\\.");
              const regex = new RegExp(globPattern.replace("\\.", "\\.") + "$");
              if (regex.test(item.name)) {
                files.push(fullPath);
              }
            } else {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    const fileStat = await stat(dir);
    if (fileStat.isFile()) {
      return [dir];
    }

    await walk(dir);
    return files;
  }
}
