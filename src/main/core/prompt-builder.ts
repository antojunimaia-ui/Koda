import * as os from "os";

export interface SystemPromptContext {
  cwd: string;
  osRelease: string;
  platform: string;
  shell: string;
  workspaceName?: string;
  additionalDirectives?: string;
}

/**
 * Builds the dynamic system prompt for Koda AI, utilizing a modular
 * prompt generation architecture.
 */
export class PromptBuilder {
  /**
   * Generates the dynamic environment details block.
   */
  public static buildEnvContext(ctx: SystemPromptContext): string {
    const shellStr = ctx.platform === "win32"
      ? `${ctx.shell} (use Unix shell syntax, not Windows — e.g., /dev/null not NUL, forward slashes)`
      : ctx.shell;

    return `
# Environment
You have been invoked in the following environment:
  - Primary working directory: ${ctx.cwd}
  - Platform: ${ctx.platform}
  - OS Version: ${ctx.osRelease}
  - Shell: ${shellStr}
${ctx.workspaceName ? `  - Project/Workspace Name: ${ctx.workspaceName}` : ""}
`.trim();
  }

  /**
   * Core instructions on how to behave as an engineer (blast radius, etc).
   */
  public static buildCoreInstructions(): string {
    return `
# Doing tasks
You are an interactive agent that helps users with software engineering tasks.
Use the instructions below and the tools available to you to assist the user.

  - The user will primarily request you to perform tasks like solving bugs, adding functionality, refactoring code.
  - Don't add features, refactor code, or make "improvements" beyond what was asked. A simple feature doesn't need extra configurability.
  - Before your first tool call, briefly state what you're about to do. While working, give short updates at key moments.
  - Avoid backwards-compatibility hacks like renaming unused _vars or adding // removed comments for removed code.
  - Be careful not to introduce security vulnerabilities (e.g. command injection, XSS).

# Executing actions with care
Carefully consider the reversibility and blast radius of actions.
  - You can freely take local, reversible actions like reading or editing files.
  - For destructive operations (e.g., rm -rf, dropping databases, mutating external states), or hard-to-reverse operations (force-pushing), you MUST ensure the user explicitly understands and approves before executing them blindly.
  - Always prefer precise tools (like file-edit) over running inline bash commands with sed or awk.
`.trim();
  }

  /**
   * Output efficiency rules (reducing fluff, no conversational loops).
   */
  public static buildOutputEfficiency(): string {
    return `
# Output efficiency
IMPORTANT: Go straight to the point. Try the simplest approach first without going in circles. Do not overdo it. Be extra concise.

Keep your text output brief and direct. Lead with the answer or action, not the reasoning. Skip filler words, preamble, and unnecessary transitions. Do not restate what the user said — just do it. When explaining, include only what is necessary for the user to understand.

If you can say it in one sentence, don't use three. Prefer short, direct sentences over long explanations. This does not apply to code or tool calls.
`.trim();
  }

  /**
   * Assembles the complete prompt given the base system prompt and environment.
   */
  public static build(
    basePrompt: string,
    context: Partial<SystemPromptContext> = {}
  ): string {
    // Attempt to gather defaults if not provided
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
    const efficiencyBlock = this.buildOutputEfficiency();

    // Assemble everything
    return [
      basePrompt,
      envBlock,
      coreBlock,
      efficiencyBlock,
      context.additionalDirectives || "",
    ]
      .filter((block) => block.trim().length > 0)
      .join("\n\n---\n\n");
  }
}
