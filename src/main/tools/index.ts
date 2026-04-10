import { BaseTool, ToolDefinition } from "./base.js";
import { FileReadTool } from "./file-read.js";
import { FileWriteTool } from "./file-write.js";
import { FileEditTool } from "./file-edit.js";
import { ShellTool, KillPtyTool, ListPtyTool, ShellInputTool, ShellWaitTool } from "./shell.js";
import { SearchTool } from "./search.js";
import { ListDirTool } from "./list-dir.js";
import { FileFindTool } from "./file-find.js";
import { BrowserTool } from "./browser.js";
import { LSPTool } from "./lsp.js";
import { EnterPlanModeTool, ExitPlanModeTool } from "./plan.js";
import { trackFile } from "../services/file-tracker.js";
import { resolve } from "path";

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  constructor() {
    this.register(new FileReadTool());
    this.register(new FileWriteTool());
    this.register(new FileEditTool());
    this.register(new ShellTool());
    this.register(new SearchTool());
    this.register(new ListDirTool());
    this.register(new FileFindTool());
    this.register(new BrowserTool());
    this.register(new LSPTool());
    this.register(new EnterPlanModeTool());
    this.register(new ExitPlanModeTool());
    this.register(new KillPtyTool());
    this.register(new ListPtyTool());
    this.register(new ShellInputTool());
    this.register(new ShellWaitTool());
  }

  private activeMode: 'fast' | 'planner' = 'fast';

  setActiveMode(mode: 'fast' | 'planner'): void {
    this.activeMode = mode;
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    if (this.activeMode === 'fast' && (name === 'enter_plan_mode' || name === 'exit_plan_mode')) {
      return undefined;
    }
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    const all = Array.from(this.tools.values());
    if (this.activeMode === 'fast') {
      return all.filter(t => t.name !== 'enter_plan_mode' && t.name !== 'exit_plan_mode');
    }
    return all;
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((t) => t.getDefinition());
  }

  async execute(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const tool = this.get(name);
    if (!tool) {
      return {
        success: false,
        output: "",
        error: `Unknown tool: ${name}`,
      };
    }

    // Hard-enforce Plan Mode restrictions
    const { getPlanMode } = await import("./plan.js");
    if (getPlanMode() === "plan") {
      const destructiveTools = ["file_write", "file_edit", "shell"];
      if (destructiveTools.includes(name)) {
        return {
          success: false,
          output: "",
          error: `[RESTRICTION] You are currently in PLAN MODE. You are FORBIDDEN from using destructive tools like '${name}' until the user approves your plan. Please finish your analysis and call 'exit_plan_mode' to present your strategy for approval.`,
        };
      }
    }

    const result = await tool.execute(args);
    this.afterExecute(name, args, result.success);
    return result;
  }

  private afterExecute(name: string, args: Record<string, unknown>, success: boolean): void {
    if (!success) return;
    const FILE_READ_TOOLS = new Set(["file_read"]);
    const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);
    const pathArg = args.path as string | undefined;
    if (!pathArg) return;
    const absPath = resolve(process.cwd(), pathArg);
    if (FILE_WRITE_TOOLS.has(name)) {
      trackFile(absPath, "modified");
    } else if (FILE_READ_TOOLS.has(name)) {
      trackFile(absPath, "read");
    }
  }

  /**
   * Convert tool definitions to the OpenAI function calling format
   */
  toOpenAITools(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.getAll().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            tool.parameters.map((p) => [
              p.name,
              {
                type: p.type === "array" ? "array" : p.type,
                description: p.description,
              },
            ])
          ),
          required: tool.parameters
            .filter((p) => p.required)
            .map((p) => p.name),
        },
      },
    }));
  }

  /**
   * Convert tool definitions to the Anthropic tool use format
   */
  toAnthropicTools(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: Object.fromEntries(
          tool.parameters.map((p) => [
            p.name,
            {
              type: p.type === "array" ? "array" : p.type,
              description: p.description,
            },
          ])
        ),
        required: tool.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }));
  }

  /**
   * Convert tool definitions to the Google Gemini function declarations format
   */
  toGoogleTools(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "OBJECT",
        properties: Object.fromEntries(
          tool.parameters.map((p) => [
            p.name,
            {
              type: p.type === "number" ? "NUMBER" :
                    p.type === "boolean" ? "BOOLEAN" :
                    p.type === "array" ? "ARRAY" : "STRING",
              description: p.description,
            },
          ])
        ),
        required: tool.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }));
  }
}
