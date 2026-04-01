import { BaseTool, ToolParameter, ToolResult } from "./base";
import { LSPClient } from "../services/lsp-client";

// Global singleton instance so it doesn't spin up every request
let clientInstance: LSPClient | null = null;

export class LSPTool extends BaseTool {
  name = "lsp_query";
  description = "Get semantic information from the language server (similar to VSCode). Use 'hover' to see types/jsdocs of symbols. Use 'goToDefinition' to find where a variable/function was declared. NOTE: line and character are 1-based.";
  parameters: ToolParameter[] = [
    {
      name: "operation",
      type: "string",
      description: "The LSP operation to perform: 'hover' | 'goToDefinition'",
      required: true
    },
    {
      name: "filePath",
      type: "string",
      description: "The path to the file you want to query",
      required: true
    },
    {
      name: "line",
      type: "number",
      description: "The 1-based line number",
      required: true
    },
    {
      name: "character",
      type: "number",
      description: "The 1-based character position on the line",
      required: true
    }
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const { operation, filePath, line, character } = args as { operation: string; filePath: string; line: number; character: number };

    if (!clientInstance) {
      // Use current working directory as project root
      clientInstance = new LSPClient(process.cwd());
      try {
        await clientInstance.start();
        // Give it a second to initialize properly
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e: any) {
        return this.failure("Failed to start typescript-language-server: " + e.message + "\nMake sure you have it installed or available via npx.");
      }
    }

    try {
      let result;
      if (operation === 'hover') {
        result = await clientInstance.getHover(filePath, line, character);
      } else if (operation === 'goToDefinition') {
        result = await clientInstance.getDefinition(filePath, line, character);
      } else {
        return this.failure(`Unknown operation: ${operation}`);
      }

      return this.success(JSON.stringify(result, null, 2) || "No results found.");
    } catch (e: any) {
      return this.failure(`LSP query failed: ${e.message}`);
    }
  }
}
