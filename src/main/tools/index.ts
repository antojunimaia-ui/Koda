import { BaseTool, ToolDefinition } from "./base.js";
import { FileReadTool } from "./file-read.js";
import { FileWriteTool } from "./file-write.js";
import { FileEditTool } from "./file-edit.js";
import { ShellTool, KillPtyTool, ListPtyTool } from "./shell.js";
import { SearchTool } from "./search.js";
import { ListDirTool } from "./list-dir.js";
import { FileFindTool } from "./file-find.js";
import { BrowserTool } from "./browser.js";
import { LSPTool } from "./lsp.js";
import { EnterPlanModeTool, ExitPlanModeTool } from "./plan.js";

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
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
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
    return tool.execute(args);
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
