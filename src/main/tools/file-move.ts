import { rename, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { checkKodaIgnore } from "../utils/kodaignore.js";

export class FileMoveTool extends BaseTool {
  name = "file_move";
  description =
    "Move or rename a file or directory. Automatically creates parent directories of target destination if they do not exist.";
  parameters: ToolParameter[] = [
    {
      name: "sourcePath",
      type: "string",
      description: "Absolute or relative path of the file or directory to move",
      required: true,
    },
    {
      name: "targetPath",
      type: "string",
      description: "Absolute or relative destination path to move it to",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const source = args.sourcePath as string;
    const target = args.targetPath as string;

    const sourcePath = resolve(process.cwd(), source);
    const targetPath = resolve(process.cwd(), target);

    // Validate KodaIgnore constraints
    const blockedSource = checkKodaIgnore(source);
    if (blockedSource) return this.failure(`Source path is restricted: ${blockedSource}`);

    const blockedTarget = checkKodaIgnore(target);
    if (blockedTarget) return this.failure(`Target path is restricted: ${blockedTarget}`);

    if (!existsSync(sourcePath)) {
      return this.failure(`Source path does not exist: ${sourcePath}`);
    }

    try {
      // Ensure the parent directory of target path exists
      await mkdir(dirname(targetPath), { recursive: true });

      // Signal progress event
      this.onProgress?.("moving", { source, target });

      await rename(sourcePath, targetPath);

      return this.success(
        `✅ Successfully moved: ${sourcePath} -> ${targetPath}`
      );
    } catch (err) {
      return this.failure(`Failed to move file/directory: ${(err as Error).message}`);
    }
  }
}
