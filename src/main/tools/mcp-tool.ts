import { BaseTool, ToolResult, ToolParameter } from "./base.js";

export class MCPTool extends BaseTool {
  constructor(
    public name: string,
    public description: string,
    public parameters: ToolParameter[],
    private serverId: string,
    private callHandler: (serverId: string, toolName: string, args: any) => Promise<ToolResult>
  ) {
    super();
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const err = this.validateArgs(args);
    if (err) return this.failure(err);
    return this.callHandler(this.serverId, this.name, args);
  }
}
