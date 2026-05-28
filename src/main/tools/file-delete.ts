import { rm } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { checkKodaIgnore } from "../utils/kodaignore.js";

export class FileDeleteTool extends BaseTool {
  name = "file_delete";
  description =
    "Delete a file or directory. If deleting a directory, the 'recursive' parameter must be set to true.";
  parameters: ToolParameter[] = [
    {
      name: "path",
      type: "string",
      description: "Absolute or relative path to the file or directory to delete",
      required: true,
    },
    {
      name: "recursive",
      type: "boolean",
      description: "Must be set to true if deleting a directory",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const pathArg = args.path as string;
    const recursive = !!args.recursive;

    const absPath = resolve(process.cwd(), pathArg);

    // Validate KodaIgnore constraints
    const blocked = checkKodaIgnore(pathArg);
    if (blocked) return this.failure(`Delete path is restricted: ${blocked}`);

    if (!existsSync(absPath)) {
      return this.failure(`Path to delete does not exist: ${absPath}`);
    }

    try {
      // Signal progress event
      this.onProgress?.("deleting", { path: pathArg });

      await rm(absPath, { recursive, force: true });

      return this.success(
        `✅ Successfully deleted: ${absPath}`
      );
    } catch (err) {
      return this.failure(`Failed to delete: ${(err as Error).message}`);
    }
  }
}
