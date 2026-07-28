import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { getSettings } from "../config/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

export class BrowserTool extends BaseTool {
  name = "browser_agent";
  description = "Starts an operantid sub-agent to navigate the web, test UI interfaces, interact with visual elements, and extract data from websites.";
  parameters: ToolParameter[] = [
    {
      name: "url",
      type: "string",
      description: "The initial URL the sub-agent should access",
      required: true,
    },
    {
      name: "task",
      type: "string",
      description: "The detailed instruction/task for the sub-agent to execute",
      required: true,
    },
    {
      name: "headless",
      type: "boolean",
      description: "If true, runs the browser hidden (default).",
      required: false,
    }
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const error = this.validateArgs(args);
    if (error) return this.failure(error);

    const url = args.url as string;
    const task = args.task as string;
    const headless = args.headless !== false;

    return new Promise((resolve) => {
      try {
        const settings = getSettings();
        // Resolve o runner a partir do CWD (raiz do projeto/build)
        const runnerPath = join((args.__cwd as string) ?? process.cwd(), "operant-runner.js");
        
        // Dispara um processo node separado para evitar conflitos de loader do Vite/Electron
        const child = spawn("node", [runnerPath], {
          env: { ...process.env },
        });

        const inputData = JSON.stringify({
          api_key: settings.apiKey,
          provider: settings.provider,
          model: settings.model,
          headless,
          url,
          task
        });

        let output = "";
        let errorOutput = "";

        child.stdin.write(inputData);
        child.stdin.end();

        child.stdout.on("data", (data) => {
          output += data.toString();
        });

        child.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        child.on("close", (code) => {
          if (code === 0) {
            resolve(this.success(`[OperantID Sub-Agent Report]\n${output}`));
          } else {
            resolve(this.failure(`Browser agent falhou (code ${code}): ${errorOutput}`));
          }
        });
      } catch (err: any) {
        resolve(this.failure(`Erro ao disparar processo: ${err.message}`));
      }
    });
  }
}
