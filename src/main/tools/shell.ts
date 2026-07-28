import * as pty from "node-pty";
import * as os from "os";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { BrowserWindow } from "electron";

const TIMEOUT_MS = 0; // 0 means no default timeout
const MAX_OUTPUT = 50_000; // Max output characters

// ─── Module-level PTY registry ────────────────────────────────────────────────
interface PtyState {
  process: pty.IPty;
  outputBuffer: string;
  isExited: boolean;
  exitCode?: number;
  runInBackground: boolean;
}

const backgroundProcesses: Map<number, PtyState> = new Map();

/** Send Ctrl+C (SIGINT) to a running background PTY. */
export function sendCtrlC(pid: number): boolean {
  const state = backgroundProcesses.get(pid);
  if (!state) return false;
  state.process.write("\x03"); // ETX character → SIGINT in a real TTY
  return true;
}

/** Send standard input to a running background PTY. */
export function sendInput(pid: number, input: string): boolean {
  const state = backgroundProcesses.get(pid);
  if (!state) return false;
  state.process.write(input);
  return true;
}

/** Hard-kill a background PTY process. */
export function killPty(pid: number): boolean {
  const state = backgroundProcesses.get(pid);
  if (!state) return false;
  state.process.kill();
  backgroundProcesses.delete(pid);
  return true;
}

/** List all active background PTY PIDs. */
export function listPtyProcesses(): number[] {
  return Array.from(backgroundProcesses.keys());
}

/** Start a persistent interactive terminal for the user. */
export function startInteractiveTerminal(cwd: string): number {
  const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env as any,
  });

  const pid = ptyProcess.pid;
  const state: PtyState = {
    process: ptyProcess,
    outputBuffer: "",
    isExited: false,
    runInBackground: true,
  };
  backgroundProcesses.set(pid, state);

  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    window.webContents.send("agent:update", {
      type: "terminal:spawned",
      pid: pid,
    });
  }

  ptyProcess.onData((data) => {
    state.outputBuffer = (state.outputBuffer + data).slice(-50000);
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      window.webContents.send("agent:update", {
        type: "terminal:output",
        pid: pid,
        data: data,
      });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    state.isExited = true;
    state.exitCode = exitCode;
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      window.webContents.send("agent:update", { type: "terminal:exit", pid });
    }
    backgroundProcesses.delete(pid);
  });

  return pid;
}

/** Write data to a PTY process. */
export function writeToPty(pid: number, data: string): boolean {
  const state = backgroundProcesses.get(pid);
  if (!state) return false;
  state.process.write(data);
  return true;
}

/** Resize a PTY process. */
export function resizePty(pid: number, cols: number, rows: number): boolean {
  const state = backgroundProcesses.get(pid);
  if (!state) return false;
  state.process.resize(cols, rows);
  return true;
}

export class ShellTool extends BaseTool {
  name = "shell";
  description =
    "Execute a shell command in the current working directory. INTEGRATION NOTE: This tool ALWAYS runs in the background and returns a PID immediately. It never blocks. If you need to see the output or wait for completion, you MUST use 'shell_wait' with the returned PID.";
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
    const safePrefixes = ["ls ", "cat ", "echo ", "pwd", "whoami", "grep ", "find ", "git status", "git log", "git diff", "dir", "type "];
    const trimmed = command.trim();
    return safePrefixes.some(prefix => trimmed === prefix || trimmed.startsWith(prefix));
  }

  // Session-persistent lists of commands allowed by the user
  private static alwaysAllowedBaseCommands: Set<string> = new Set();
  private static alwaysAllowedFullCommands: Set<string> = new Set();
  
  // Promise handling for UI approval
  private static pendingApproval: {
    resolve: (response: { approved: boolean, alwaysAllowBase?: boolean, alwaysAllowFull?: boolean }) => void;
  } | null = null;

  /** Get the current list of session-approved commands */
  public static getApprovedCommands() {
    return {
      base: Array.from(this.alwaysAllowedBaseCommands),
      full: Array.from(this.alwaysAllowedFullCommands)
    };
  }

  /** Update the session-approved commands list */
  public static updateApprovedCommands(lists: { base?: string[], full?: string[] }) {
    if (lists.base) {
      this.alwaysAllowedBaseCommands = new Set(lists.base);
    }
    if (lists.full) {
      this.alwaysAllowedFullCommands = new Set(lists.full);
    }
  }

  /** Called by IPC to resolve a pending shell approval */
  public static resolveApproval(approved: boolean, alwaysAllowBase: boolean = false, alwaysAllowFull: boolean = false) {
    if (this.pendingApproval) {
      this.pendingApproval.resolve({ approved, alwaysAllowBase, alwaysAllowFull });
      this.pendingApproval = null;
    }
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const command = args.command as string;
    const desc = args.description as string;
    const runInBackground = true; // Forced to true per user request
    const cwd = (args.cwd as string) || (args.__cwd as string) || process.cwd();
    
    // Check if command or its base is already allowed
    const baseCommand = command.trim().split(/\s+/)[0];
    const isBaseAllowed = ShellTool.alwaysAllowedBaseCommands.has(baseCommand);
    const isFullAllowed = ShellTool.alwaysAllowedFullCommands.has(command.trim());
    const isSafe = this.isReadOnly(command);

    if (!isSafe && !isBaseAllowed && !isFullAllowed) {
      // Request approval from renderer
      const window = BrowserWindow.getAllWindows()[0];
      if (window) {
        window.webContents.send('agent:update', { 
          type: 'shell_awaiting_approval', 
          command, 
          description: desc,
          baseCommand
        });

        // Wait for user response
        const { approved, alwaysAllowBase, alwaysAllowFull } = await new Promise<{ approved: boolean, alwaysAllowBase?: boolean, alwaysAllowFull?: boolean }>((resolve) => {
          ShellTool.pendingApproval = { resolve };
        });

        if (!approved) {
          return this.failure(`Command execution rejected by user: ${command}`);
        }

        if (alwaysAllowBase) {
          ShellTool.alwaysAllowedBaseCommands.add(baseCommand);
        }
        if (alwaysAllowFull) {
          ShellTool.alwaysAllowedFullCommands.add(command.trim());
        }
      }
    }

    // Block dangerous commands explicitly
    const dangerous = ["rm -rf /", "format c:", "del /s /q c:\\", "mkfs"];
    if (dangerous.some((d) => command.toLowerCase().includes(d))) {
      return this.failure(`⚠️ Blocked: Command '${command}' triggers destructive safety constraints.`);
    }

    console.log(`[ShellTool PTY] Executing: ${desc} \n($ ${command}) | Background: ${runInBackground}`);

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs = os.platform() === 'win32' 
      ? ['-NoProfile', '-NonInteractive', '-Command', command] 
      : ['-c', command];

    // Background execution via PTY (Now Always)
    try {
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: cwd,
        env: process.env as any
      });

      const pid = ptyProcess.pid;
      const state: PtyState = {
        process: ptyProcess,
        outputBuffer: "",
        isExited: false,
        runInBackground: true
      };
      backgroundProcesses.set(pid, state);

      // Notify renderer about the new PID immediately
      const window = BrowserWindow.getAllWindows()[0];
      if (window) {
        window.webContents.send('agent:update', { 
          type: 'pty_spawned',
          pid: pid,
          name: "shell"
        });
      }

      // Emit chunks to renderer via IPC (Electron)
      ptyProcess.onData((data) => {
        // Update internal buffer (keep last 50k chars)
        state.outputBuffer = (state.outputBuffer + data).slice(-50000);

        const window = BrowserWindow.getAllWindows()[0];
        if (window) {
          window.webContents.send('agent:update', { 
            type: 'pty_output',
            pid: pid, 
            data: data 
          });
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        state.isExited = true;
        state.exitCode = exitCode;
        // Notify renderer the process ended
        const window = BrowserWindow.getAllWindows()[0];
        if (window) {
          window.webContents.send('agent:update', { type: 'pty_exit', pid });
        }
      });
      
      return this.success(`[Background PTY Started] PID: ${pid}\nCommand: ${command}\nThe PTY is running persistently. Use 'shell_wait' to monitor output or check the UI.`);
    } catch (err: any) {
      return this.failure(`Failed to start PTY background task: ${err.message}`);
    }
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
  description = "List all currently running background PTY processes. Use this to find the PID of a process you want to stop or interact with.";
  parameters: ToolParameter[] = [];

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const pids = listPtyProcesses();
    if (pids.length === 0) {
      return this.success("No background PTY processes are currently running.");
    }
    return this.success(
      `Running background PTY processes:\n${pids.map(pid => `  • PID ${pid}`).join("\n")}\n\nUse shell_input or kill_pty with the PID to interact with or stop one.`
    );
  }
}

// ─── ShellInputTool ───────────────────────────────────────────────────────────

export class ShellInputTool extends BaseTool {
  name = "shell_input";
  description = "Send standard input (text) to a running background PTY process. Use this to answer prompts (like 'y/n') or interact with CLI tools (like REPLs).";
  parameters: ToolParameter[] = [
    {
      name: "pid",
      type: "number",
      description: "The PID of the background PTY process to send input to.",
      required: true,
    },
    {
      name: "input",
      type: "string",
      description: "The text to send to the process. Include a newline (\\n) if you want to 'press enter'.",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const pid = args.pid as number;
    const input = args.input as string;

    const ok = sendInput(pid, input);
    if (ok) {
      return this.success(`Successfully sent input to process ${pid}.`);
    } else {
      return this.failure(`No running background PTY found with PID ${pid}.`);
    }
  }
}

// ─── ShellWaitTool ────────────────────────────────────────────────────────────

export class ShellWaitTool extends BaseTool {
  name = "shell_wait";
  description = "Wait for a specific pattern to appear in a background PTY's output, or wait for the process to exit. Useful for timing interactions with long-running commands.";
  parameters: ToolParameter[] = [
    {
      name: "pid",
      type: "number",
      description: "The PID of the background PTY process to monitor.",
      required: true,
    },
    {
      name: "pattern",
      type: "string",
      description: "A string or regex pattern to wait for in the output. If omitted, waits for the process to exit.",
      required: false,
    },
    {
      name: "timeout",
      type: "number",
      description: "Max time to wait in milliseconds. Default 30,000 (30 seconds).",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const pid = args.pid as number;
    const pattern = args.pattern as string | undefined;
    const timeout = (args.timeout as number) || 30_000;

    const state = backgroundProcesses.get(pid);
    if (!state) return this.failure(`No running background PTY found with PID ${pid}.`);

    return new Promise((resolve) => {
      let isSettled = false;
      const startTime = Date.now();

      const check = () => {
        if (isSettled) return;

        // Check for process exit
        if (state.isExited) {
          isSettled = true;
          return resolve(this.success(`Process ${pid} finished with code ${state.exitCode}.\n\nFinal Output:\n${state.outputBuffer}`));
        }

        // Check for pattern if provided
        if (pattern) {
          try {
            // Strip ANSI codes for cleaner matching
            const cleanBuffer = state.outputBuffer.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            const regex = new RegExp(pattern, 'i'); // Case-insensitive for robustness
            
            if (regex.test(cleanBuffer) || cleanBuffer.includes(pattern)) {
              isSettled = true;
              return resolve(this.success(`Pattern '${pattern}' found in output of PID ${pid}.\n\nRecent Output:\n${cleanBuffer.slice(-1000)}`));
            }
          } catch (err) {
            // Fallback to simple inclusion if regex is invalid
            if (state.outputBuffer.includes(pattern)) {
              isSettled = true;
              return resolve(this.success(`Literal pattern '${pattern}' found in output of PID ${pid} (regex was invalid).\n\nRecent Output:\n${state.outputBuffer.slice(-500)}`));
            }
          }
        }

        // Check for timeout
        if (Date.now() - startTime > timeout) {
          isSettled = true;
          return resolve(this.failure(`Timed out waiting for PID ${pid} after ${timeout}ms.`));
        }

        // Poll again
        setTimeout(check, 300); // Polling every 300ms is sufficient
      };

      check();
    });
  }
}
