import { writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";

export class FileWriteTool extends BaseTool {
  name = "file_write";
  description =
    "Write content to a file. Creates the file and any parent directories if they don't exist. Overwrites existing files.";
  parameters: ToolParameter[] = [
    {
      name: "path",
      type: "string",
      description: "Absolute or relative path to the file to write",
      required: true,
    },
    {
      name: "content",
      type: "string",
      description: "The content to write to the file",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const filePath = resolve(process.cwd(), args.path as string);
    const content = args.content as string;
    const isNew = !existsSync(filePath);

    try {
      // Ensure parent directories exist
      await mkdir(dirname(filePath), { recursive: true });
      // Notify renderer that the actual disk write is about to happen
      this.onProgress?.('writing', { path: args.path as string })
      await writeFile(filePath, content, "utf-8");

      const lineCount = content.split("\n").length;
      const action = isNew ? "Created" : "Updated";
      return this.success(
        `✅ ${action} file: ${filePath} (${lineCount} lines, ${content.length} bytes)`
      );
    } catch (err) {
      return this.failure(`Failed to write file: ${(err as Error).message}`);
    }
  }
}
