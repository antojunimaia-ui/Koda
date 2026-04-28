import { readFile } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { detectLanguage, highlightCode } from "../utils/syntax.js";
import { checkKodaIgnore } from "../utils/kodaignore.js";

export class FileReadTool extends BaseTool {
  name = "file_read";
  description =
    "Read the contents of a file from the filesystem. Returns the file content with line numbers.";
  parameters: ToolParameter[] = [
    {
      name: "path",
      type: "string",
      description: "Absolute or relative path to the file to read",
      required: true,
    },
    {
      name: "start_line",
      type: "number",
      description: "Start line number (1-indexed, inclusive). Optional.",
      required: false,
    },
    {
      name: "end_line",
      type: "number",
      description: "End line number (1-indexed, inclusive). Optional.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const filePath = resolve(process.cwd(), args.path as string);

    const blocked = checkKodaIgnore(args.path as string);
    if (blocked) return this.failure(blocked);

    if (!existsSync(filePath)) {
      return this.failure(`File not found: ${filePath}`);
    }

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const startLine = Math.max(1, (args.start_line as number) || 1);
      const endLine = Math.min(
        lines.length,
        (args.end_line as number) || lines.length
      );

      const selectedLines = lines.slice(startLine - 1, endLine);
      const numbered = selectedLines
        .map((line, i) => `${String(startLine + i).padStart(4)} │ ${line}`)
        .join("\n");

      const lang = detectLanguage(filePath);
      const totalLines = lines.length;

      let header = `📄 ${filePath} (${totalLines} lines, language: ${lang})`;
      if (startLine > 1 || endLine < totalLines) {
        header += ` [showing lines ${startLine}-${endLine}]`;
      }

      return this.success(`${header}\n\n${numbered}`);
    } catch (err) {
      return this.failure(`Failed to read file: ${(err as Error).message}`);
    }
  }
}
