export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ToolParameter[];

  /** Injected by ToolRegistry before execute() — tools call this right before performing I/O */
  onProgress?: (event: string, data?: Record<string, unknown>) => void;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  abstract execute(args: Record<string, unknown>): Promise<ToolResult>;

  protected validateArgs(args: Record<string, unknown>): string | null {
    for (const param of this.parameters) {
      if (param.required && !(param.name in args)) {
        return `Missing required parameter: ${param.name}`;
      }
    }
    return null;
  }

  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  protected failure(error: string): ToolResult {
    return { success: false, output: "", error };
  }
}
