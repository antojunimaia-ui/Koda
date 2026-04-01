import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { getSettings } from "../config/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

export class BrowserTool extends BaseTool {
  name = "browser_agent";
  description = "Inicia um sub-agente operantid para navegar na web, testar interfaces UI, interagir com elementos visuais e extrair dados de sites.";
  parameters: ToolParameter[] = [
    {
      name: "url",
      type: "string",
      description: "A URL inicial que o sub-agente deve acessar",
      required: true,
    },
    {
      name: "task",
      type: "string",
      description: "A instrução/tarefa detalhada para o sub-agente executar",
      required: true,
    },
    {
      name: "headless",
      type: "boolean",
      description: "Se true, roda o navegador de forma oculta (padrão).",
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
        const runnerPath = join(process.cwd(), "operant-runner.js");
        
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
