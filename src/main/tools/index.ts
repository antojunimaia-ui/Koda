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
import { StartColabTool, SendColabTool, EndColabTool } from "./collaborate.js";
import { EnterPlanModeTool, ExitPlanModeTool } from "./plan.js";
import { LoadSkillTool } from "./skill.js";
import { DiagnosticsTool } from "./diagnostics.js";
import { WebSearchTool } from "./web-search.js";
import { WebFetchTool } from "./web-fetch.js";
import { QuestionsTool } from "./questions.js";
import { trackFile } from "../services/file-tracker.js";
import { AppSettings } from "../config/settings.js";
import { resolve } from "path";

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();
  private progressEmitter?: (event: string, toolName: string, data?: Record<string, unknown>) => void;

  setProgressEmitter(fn: (event: string, toolName: string, data?: Record<string, unknown>) => void): void {
    this.progressEmitter = fn;
  }

  constructor(settings: AppSettings) {
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
    this.register(new StartColabTool(settings));
    this.register(new SendColabTool());
    this.register(new EndColabTool());
    this.register(new LoadSkillTool());
    this.register(new DiagnosticsTool());
    this.register(new WebSearchTool());
    this.register(new WebFetchTool());
    this.register(new QuestionsTool());
  }

  clearNonCoreTools(): void {
    const coreTools = ["file_read", "file_write", "file_edit", "shell", "search", "list_dir", "file_find", "browser", "lsp", "enter_plan_mode", "exit_plan_mode", "kill_pty", "list_pty", "shell_input", "shell_wait", "start_collaboration", "send_to_advisor", "end_collaboration", "load_skill", "get_diagnostics", "web_search", "web_fetch", "questions"];
    for (const name of this.tools.keys()) {
      if (!coreTools.includes(name)) {
        this.tools.delete(name);
      }
    }
  }

  registerDynamic(tool: BaseTool): void {
    this.register(tool);
  }

  private activeMode: 'fast' | 'planner' | 'colab' = 'fast';

  setActiveMode(mode: 'fast' | 'planner' | 'colab'): void {
    this.activeMode = mode;
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    const colabTools = ['start_collaboration', 'send_to_advisor', 'end_collaboration'];
    
    if (this.activeMode !== 'colab' && colabTools.includes(name)) {
      return undefined;
    }

    if (this.activeMode === 'fast' && (name === 'enter_plan_mode' || name === 'exit_plan_mode')) {
      return undefined;
    }
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    const all = Array.from(this.tools.values());
    const colabTools = ['start_collaboration', 'send_to_advisor', 'end_collaboration'];

    let filtered = all;

    if (this.activeMode !== 'colab') {
      filtered = filtered.filter(t => !colabTools.includes(t.name));
    }

    if (this.activeMode === 'fast') {
      filtered = filtered.filter(t => t.name !== 'enter_plan_mode' && t.name !== 'exit_plan_mode');
    }

    return filtered;
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

    // Inject progress emitter so tools can signal real-time I/O events
    tool.onProgress = this.progressEmitter
      ? (event, data) => this.progressEmitter!(event, name, data)
      : undefined;

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
