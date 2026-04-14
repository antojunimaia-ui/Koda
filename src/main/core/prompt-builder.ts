import * as os from "os";

export interface SystemPromptContext {
  cwd: string;
  osRelease: string;
  platform: string;
  shell: string;
  workspaceName?: string;
  projectSummary?: string; // High-level architecture summary
  additionalDirectives?: string;
  toolsMetadata?: string; // List of available tool names/descriptions
}

/**
 * Builds the dynamic system prompt for Koda AI.
 * This class handles the technical environment details and core operational rules.
 */
export class PromptBuilder {
  /**
   * Generates the dynamic environment details block.
   */
  public static buildEnvContext(ctx: SystemPromptContext): string {
    const shellStr = ctx.platform === "win32"
      ? `${ctx.shell} (use Unix/Forward-Slash syntax even on Windows for tools compatibility)`
      : ctx.shell;

    return `
# ENVIRONMENT CONTEXT
- **Current Working Directory**: ${ctx.cwd}
- **Platform**: ${ctx.platform}
- **OS Version**: ${ctx.osRelease}
- **Shell**: ${shellStr}
${ctx.workspaceName ? `- **Active Project**: ${ctx.workspaceName}` : ""}
`.trim();
  }

  /**
   * Engineering excellence and operational safety rules.
   */
  public static buildCoreInstructions(): string {
    return `
# OPERATIONAL COMMANDMENTS
1. **Architectural Stewardship & Intentional Verification**: Leverage your internal project context/summary to identify relevant modules. Use tools like \`ls\` or \`grep\` only to verify specific implementation details or to study files you haven't seen yet. Do not perform redundant re-reads of files you already understand.
2. **Atomic & Precise Edits**: When using file manipulation tools, focus on the specific logic requested. Respect existing indentation and coding style (matching the file's current pattern).
3. **Safety & Blast Radius**: High-risk commands (destructive shell operations) require a brief warning to the user. Standard file edits and reads are encouraged to be autonomous.
4. **No Placeholders**: Never emit incomplete code. Comments like "// ... rest of code" are forbidden. Implement the full requested logic.
5. **Recursive Problem Solving**: If a tool fails or an error occurs in the shell, analyze the output, hypothesize the fix, and execute a new approach immediately.
6. **Fast Mode Execution**: Unless explicitly instructed to use Planner Mode, you are in Fast Mode. In Fast Mode, you act immediately and autonomously. You must ignore the existence of 'enter_plan_mode' and 'exit_plan_mode' tools.
7. **Read Efficiency**: When dealing with large files (> 300 lines) or looking for specific code, avoid reading the entire file. Always prefer using \`file_read\` with \`start_line\` and \`end_line\` parameters to focus only on the relevant sections. Use \`search\` or \`lsp\` to find the exact line numbers first.
`.trim();
  }

  /**
   * Assembles the complete prompt given the base system prompt and environment.
   */
  public static build(
    basePrompt: string,
    context: Partial<SystemPromptContext> = {}
  ): string {
    const cwd = context.cwd || process.cwd();
    const osRelease = context.osRelease || os.release();
    const platform = context.platform || os.platform();
    const shell = context.shell || process.env.SHELL || process.env.COMSPEC || "unknown";

    const envBlock = this.buildEnvContext({
      cwd,
      osRelease,
      platform,
      shell,
      workspaceName: context.workspaceName,
    });

    const coreBlock = this.buildCoreInstructions();
    const toolsBlock = context.toolsMetadata ? `# AVAILABLE TOOLS\nYou have access to the following dynamic and core capabilities:\n${context.toolsMetadata}` : "";

    const projectBlock = context.projectSummary ? `# PROJECT ARCHITECTURE\n${context.projectSummary}` : "";

    // Assemble modular blocks
    return [
      basePrompt,
      envBlock,
      projectBlock,
      coreBlock,
      toolsBlock,
      context.additionalDirectives || "",
    ]
      .filter((block) => block.trim().length > 0)
      .join("\n\n---\n\n");
  }
}
