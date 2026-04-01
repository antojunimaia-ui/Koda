import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { applyStringEdit, generateDiff } from "../utils/diff.js";

export class FileEditTool extends BaseTool {
  name = "file_edit";
  description =
    "Edit a file by replacing a specific string with new content. The target string must be an exact match of existing content in the file.";
  parameters: ToolParameter[] = [
    {
      name: "path",
      type: "string",
      description: "Absolute or relative path to the file to edit",
      required: true,
    },
    {
      name: "target",
      type: "string",
      description:
        "The exact string to find and replace. Must match existing content exactly, including whitespace.",
      required: true,
    },
    {
      name: "replacement",
      type: "string",
      description: "The new content to replace the target with",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const filePath = resolve(process.cwd(), args.path as string);
    const target = args.target as string;
    const replacement = args.replacement as string;

    if (!existsSync(filePath)) {
      return this.failure(`File not found: ${filePath}`);
    }

    try {
      const oldContent = await readFile(filePath, "utf-8");
      const { success, result, matchCount } = applyStringEdit(
        oldContent,
        target,
        replacement
      );

      if (!success) {
        return this.failure(
          `Target string not found in ${filePath}. Make sure the target matches exactly, including whitespace and indentation.`
        );
      }

      await writeFile(filePath, result, "utf-8");

      const diff = generateDiff(filePath, oldContent, result);
      let message = `✅ Edited ${filePath}`;
      if (matchCount > 1) {
        message += ` (found ${matchCount} matches, replaced first occurrence)`;
      }

      return this.success(`${message}\n\n${diff}`);
    } catch (err) {
      return this.failure(`Failed to edit file: ${(err as Error).message}`);
    }
  }
}
