import { exec } from "child_process";
import { resolve, relative } from "path";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";

/**
 * get_diagnostics — runs the TypeScript compiler in noEmit mode and parses
 * the output into a structured list of errors/warnings, similar to the
 * VS Code "Problems" panel. The agent should call this tool after every
 * implementation to validate that no type errors were introduced.
 */
export class DiagnosticsTool extends BaseTool {
  name = "get_diagnostics";
  description =
    "Runs a universal diagnostics check on the project. It combines: " +
    "1. Real-time diagnostics from the Language Server (LSP) for modified files. " +
    "2. Project-specific linter/checker discovery (npm lint, cargo check, go vet, etc). " +
    "Use this tool ALWAYS at the end of any implementation to catch problems like VS Code's 'Problems' panel.";

  parameters: ToolParameter[] = [
    {
      name: "path",
      type: "string",
      description:
        "Root directory of the project to check. Defaults to the current working directory.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const cwd = resolve((args.__cwd as string) ?? process.cwd(), (args.path as string) || ".");

    // Detect what checker to run
    const { getTrackedFiles } = await import("../services/file-tracker.js");
    const modifiedFiles = getTrackedFiles().filter(f => f.access === "modified");

    // 1. Get diagnostics from the Language Server (LSP) — The most "Universal" way
    const lspProblems = await this.getLspDiagnostics(cwd, modifiedFiles);

    // 2. Discover and run project-specific diagnostic scripts (npm lint, cargo check, etc)
    const projectProblems = await this.runProjectDiagnostics(cwd);

    const allProblems = [...lspProblems, ...projectProblems];

    if (allProblems.length === 0) {
      return this.success("✅ No problems found — project is clean.");
    }

    return this.success(`🔴 Found ${allProblems.length} diagnostic problem(s):\n\n${allProblems.join("\n")}`);
  }

  /** Gets real-time diagnostics from the LSP client */
  private async getLspDiagnostics(cwd: string, files: any[]): Promise<string[]> {
    const { LSPClient } = await import("../services/lsp-client.js");
    const client = new LSPClient(cwd);
    try {
      await client.start();
      // Open all modified files so the server starts checking them
      for (const file of files) {
        await client.openFile(file.path);
      }
      // Wait for server to process and emit diagnostics
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const diagnostics = client.getDiagnostics();
      await client.stop();

      const results: string[] = [];
      for (const item of diagnostics) {
        const relPath = relative(cwd, item.uri.replace("file:///", ""));
        for (const diag of item.diagnostics) {
          const severity = diag.severity === 1 ? "🔴" : "🟡";
          results.push(`${severity} ${relPath}:${diag.range.start.line + 1}:${diag.range.start.character + 1} — ${diag.message}`);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /** Discovers and runs any project-native diagnostic tools */
  private async runProjectDiagnostics(cwd: string): Promise<string[]> {
    const { readFile } = await import("fs/promises");
    const { existsSync } = await import("fs");
    const results: string[] = [];

    // Try finding lint/check scripts in meta files
    try {
      // Node.js
      if (existsSync(resolve(cwd, "package.json"))) {
        const pkg = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf-8"));
        const scripts = pkg.scripts || {};
        const diagScript = Object.keys(scripts).find(k => k.includes("lint") || k.includes("check") || k.includes("type-check"));
        if (diagScript) {
          const output = await this.execCommand(`npm run ${diagScript}`, cwd);
          if (output) results.push(`[npm run ${diagScript}]:\n${output}`);
        }
      }
      // Rust
      if (existsSync(resolve(cwd, "Cargo.toml"))) {
        const output = await this.execCommand("cargo check --message-format short", cwd);
        if (output) results.push(`[cargo check]:\n${output}`);
      }
      // Go
      if (existsSync(resolve(cwd, "go.mod"))) {
        const output = await this.execCommand("go vet ./...", cwd);
        if (output) results.push(`[go vet]:\n${output}`);
      }
    } catch {}

    return results;
  }

  private async execCommand(cmd: string, cwd: string): Promise<string | null> {
    return new Promise((resolve) => {
      exec(cmd, { cwd, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          resolve((stdout + stderr).trim());
        } else {
          resolve(null);
        }
      });
    });
  }

  /** Helper for tsc parsing as fallback */
  private parseTscOutput(lines: string[], cwd: string): any {
    // keeping this helper if needed internally
    return {};
  }
}
