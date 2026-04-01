import * as pty from "node-pty";
import * as os from "os";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { BrowserWindow } from "electron";

const TIMEOUT_MS = 60_000; // 60 seconds default timeout
const MAX_OUTPUT = 50_000; // Max output characters

// ─── Module-level PTY registry ────────────────────────────────────────────────
// Shared so IPC handlers (index.ts) can control background processes directly.
const backgroundProcesses: Map<number, pty.IPty> = new Map();

/** Send Ctrl+C (SIGINT) to a running background PTY. */
export function sendCtrlC(pid: number): boolean {
  const proc = backgroundProcesses.get(pid);
  if (!proc) return false;
  proc.write("\x03"); // ETX character → SIGINT in a real TTY
  return true;
}

/** Hard-kill a background PTY process. */
export function killPty(pid: number): boolean {
  const proc = backgroundProcesses.get(pid);
  if (!proc) return false;
  proc.kill();
  backgroundProcesses.delete(pid);
  return true;
}

/** List all active background PTY PIDs. */
export function listPtyProcesses(): number[] {
  return Array.from(backgroundProcesses.keys());
}

export class ShellTool extends BaseTool {
  name = "shell";
  description =
    "Execute a shell command in the current working directory. Returns stdout and stderr via a real pseudoterminal (PTY). Use this for all command line operations.";
  parameters: ToolParameter[] = [
    {
      name: "command",
      type: "string",
      description: "The shell command to execute",
      required: true,
    },
    {
      name: "description",
      type: "string",
      description: "Clear, concise description of what this command does in active voice. For example: 'Install package dependencies' or 'Start dev server'",
      required: true,
    },
    {
      name: "run_in_background",
      type: "boolean",
      description: "Set to true to run this command in the background without blocking. Essential for long-running tasks like dev servers or watchers.",
      required: false,
    },
    {
      name: "cwd",
      type: "string",
      description: "Optional working directory for the command. Defaults to current directory.",
      required: false,
    },
    {
      name: "timeout",
      type: "number",
      description: "Optional timeout in milliseconds. Default is 60000 (60 seconds).",
      required: false,
    },
  ];

  // Identifies if command safe to run without user approval
  public isReadOnly(command: string): boolean {
    const safePrefixes = ["ls", "cat", "echo", "pwd", "whoami", "grep", "find", "git status", "git log", "git diff"];
    return safePrefixes.some(prefix => command.trim().startsWith(prefix));
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const command = args.command as string;
    const desc = args.description as string;
    const runInBackground = args.run_in_background as boolean;
    const cwd = (args.cwd as string) || process.cwd();
    const timeoutMsg = (args.timeout as number) || TIMEOUT_MS;

    // Block dangerous commands explicitly
    const dangerous = ["rm -rf /", "format c:", "del /s /q c:\\", "mkfs"];
    if (dangerous.some((d) => command.toLowerCase().includes(d))) {
      return this.failure(`⚠️ Blocked: Command '${command}' triggers destructive safety constraints.`);
    }

    // Guard against blocking UI sleep/loops
    if (!runInBackground && command.trim().match(/^sleep\s+\d+$/)) {
      return this.failure(`⚠️ Blocked: You attempted to run a synchronous sleep. Run blocking commands in the background with run_in_background: true.`);
    }

    console.log(`[ShellTool PTY] Executing: ${desc} \n($ ${command}) | Background: ${runInBackground}`);

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs = os.platform() === 'win32' 
      ? ['-NoProfile', '-NonInteractive', '-Command', command] 
      : ['-c', command];

    if (runInBackground) {
      // Background execution via PTY
      try {
        const ptyProcess = pty.spawn(shell, shellArgs, {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: cwd,
          env: process.env as any
        });

        const pid = ptyProcess.pid;
        backgroundProcesses.set(pid, ptyProcess);

        // Emit chunks to renderer via IPC (Electron)
        ptyProcess.onData((data) => {
          const window = BrowserWindow.getAllWindows()[0];
          if (window) {
            window.webContents.send('agent:update', { 
              type: 'pty_output',
              pid: pid, 
              data: data 
            });
          }
        });

        ptyProcess.onExit(() => {
          backgroundProcesses.delete(pid);
          // Notify renderer the process ended
          const window = BrowserWindow.getAllWindows()[0];
          if (window) {
            window.webContents.send('agent:update', { type: 'pty_exit', pid });
          }
        });
        
        return this.success(`[Background PTY Started] PID: ${pid}\nCommand: ${command}\nO PTY está rodando de forma persistente. A saída pode ser conectada ao frontend.`);
      } catch (err: any) {
        return this.failure(`Failed to start PTY background task: ${err.message}`);
      }
    }

    // Synchronous execution (blocking)
    return new Promise((resolve) => {
      let output = "";
      let isResolved = false;
      let timer: NodeJS.Timeout | null = null;

      try {
        const ptyProcess = pty.spawn(shell, shellArgs, {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: cwd,
          env: process.env as any
        });

        const finish = (result: ToolResult) => {
          if (isResolved) return;
          isResolved = true;
          if (timer) clearTimeout(timer);
          
          // Strip ANSI Escape Codes for LLM readability
          let cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

          if (cleanOutput.length > MAX_OUTPUT) {
            const truncatedSize = cleanOutput.length - MAX_OUTPUT;
            cleanOutput = cleanOutput.substring(0, MAX_OUTPUT) + 
              `\n\n...<output> (${truncatedSize} bytes omitted). Tip: Save output to a file and read it or use search tools for large outputs.`;
          }
          
          if (result.success) {
            result.output = cleanOutput.trim() || "(no output)";
          } else {
            result.error = (result.error || "") + `\n\nOutput:\n${cleanOutput.trim()}`;
          }
          resolve(result);
        };

        ptyProcess.onData((data) => {
          output += data;
        });

        ptyProcess.onExit(({ exitCode }) => {
          if (exitCode === 0) {
            finish(this.success(output));
          } else {
            finish(this.failure(`Command exited with code ${exitCode}`));
          }
        });

        timer = setTimeout(() => {
          ptyProcess.kill();
          finish(this.failure(`Command timed out after ${timeoutMsg / 1000} seconds.`));
        }, timeoutMsg);

      } catch (err: any) {
        if (!isResolved) {
          isResolved = true;
          resolve(this.failure(`Failed to execute PTY: ${err.message}`));
        }
      }
    });
  }
}

// ─── KillPtyTool ──────────────────────────────────────────────────────────────

export class KillPtyTool extends BaseTool {
  name = "kill_pty";
  description = `Stop a background PTY process that was started with shell(run_in_background=true).

Use this tool when:
- A dev server or watcher process needs to be restarted
- A background process is no longer needed
- You need to free up a port before running a new server

You can send a graceful Ctrl+C first with signal="sigint", or force-kill with signal="sigkill".
Always prefer sigint first; only use sigkill if the process doesn't stop.`;

  parameters: ToolParameter[] = [
    {
      name: "pid",
      type: "number",
      description: "The PID of the background PTY process to stop. This was returned when you started the background process with shell().",
      required: true,
    },
    {
      name: "signal",
      type: "string",
      description: "How to stop the process: 'sigint' sends Ctrl+C (graceful), 'sigkill' force-kills immediately. Defaults to 'sigint'.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const pid = args.pid as number;
    const signal = (args.signal as string | undefined) ?? "sigint";

    if (!backgroundProcesses.has(pid)) {
      return this.failure(`No active background PTY with PID ${pid}. It may have already exited. Use list_pty to see running processes.`);
    }

    if (signal === "sigkill") {
      const ok = killPty(pid);
      return ok
        ? this.success(`PTY process ${pid} force-killed (SIGKILL).`)
        : this.failure(`Failed to kill PTY ${pid}.`);
    }

    // Default: graceful Ctrl+C
    const ok = sendCtrlC(pid);
    return ok
      ? this.success(`Sent Ctrl+C (SIGINT) to PTY process ${pid}. The process should stop gracefully. If it doesn't respond, call kill_pty again with signal="sigkill".`)
      : this.failure(`Failed to send SIGINT to PTY ${pid}.`);
  }
}

// ─── ListPtyTool ──────────────────────────────────────────────────────────────

export class ListPtyTool extends BaseTool {
  name = "list_pty";
  description = "List all currently running background PTY processes. Use this to find the PID of a process you want to stop with kill_pty.";
  parameters: ToolParameter[] = [];

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const pids = listPtyProcesses();
    if (pids.length === 0) {
      return this.success("No background PTY processes are currently running.");
    }
    return this.success(
      `Running background PTY processes:\n${pids.map(pid => `  • PID ${pid}`).join("\n")}\n\nUse kill_pty with the PID to stop one.`
    );
  }
}
