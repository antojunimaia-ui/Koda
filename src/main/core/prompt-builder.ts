import * as os from "os";

export interface SystemPromptContext {
  cwd: string;
  osRelease: string;
  platform: string;
  shell: string;
  workspaceName?: string;
  projectSummary?: string; // High-level architecture summary
  projectRules?: string; // Project-specific rules from .agents/rules.md
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
# OPERATIONAL RULES
1. **Explore first**: Before editing any file, use \`search\` or \`lsp_query\` to locate the exact symbol or block. Never read a full file when you only need a function.
2. **Surgical edits**: Use \`file_edit\` for existing files. Use \`file_write\` only for new files or full rewrites. Prefer the smallest diff that achieves the goal.
3. **No placeholders**: Deliver complete, working code. "// rest of implementation" or "// TODO" are forbidden.
4. **Style conformance**: Match the file's existing indentation, naming, and import style exactly.
5. **Diagnose after every change**: Call \`get_diagnostics\` after any edit or implementation. Fix all reported errors before stopping.
6. **Fail fast, fix fast**: If a shell command or tool fails, read the error output, form a hypothesis, and retry with a corrected approach immediately.
7. **No redundant reads**: Don't re-read files you've already seen in this session unless they were modified.
8. **Shell hygiene**: Prefer non-interactive commands. For long-running processes, use \`shell\` + \`shell_wait\` with a pattern to detect readiness.
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
    const rulesBlock = context.projectRules ? `# PROJECT RULES\n${context.projectRules}` : "";

    // Assemble modular blocks
    return [
      basePrompt,
      envBlock,
      projectBlock,
      rulesBlock,
      coreBlock,
      toolsBlock,
      context.additionalDirectives || "",
    ]
      .filter((block) => block.trim().length > 0)
      .join("\n\n---\n\n");
  }
}
