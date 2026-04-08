import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

// Load .env from current working directory
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
}

// Also try home directory
const homeEnvPath = resolve(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".koda",
  ".env"
);
if (existsSync(homeEnvPath)) {
  config({ path: homeEnvPath });
}

// Fallback: Also try the Koda CLI installation directory (useful for global npm link during dev)
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // In dist/index.js, root is one level up
  const cliRootEnvPath = resolve(__dirname, "../.env");
  if (existsSync(cliRootEnvPath)) {
    config({ path: cliRootEnvPath });
  }
} catch (e) {
  // Ignore
}

export type LLMProvider = "openai" | "anthropic" | "google" | "openrouter" | "ollama" | "llamacpp" | "groq" | "deepseek" | "mistral" | "together" | "xai" | "zhipu" | "maritaca";

export interface AppSettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
  openrouter: "anthropic/claude-3.7-sonnet",
  ollama: "llama3",
  llamacpp: "local-model",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  mistral: "codestral-latest",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  xai: "grok-beta",
  zhipu: "glm-5",
  maritaca: "sabia-4",
};

export function getSettings(): AppSettings {
  const provider = (process.env.LLM_PROVIDER || "openai") as LLMProvider;

  const apiKeyMap: Record<LLMProvider, string> = {
    openai: process.env.OPENAI_API_KEY || "",
    anthropic: process.env.ANTHROPIC_API_KEY || "",
    google: process.env.GOOGLE_API_KEY || "",
    openrouter: process.env.OPENROUTER_API_KEY || "",
    ollama: process.env.OLLAMA_API_KEY || "",
    llamacpp: process.env.LLAMACPP_API_KEY || "",
    groq: process.env.GROQ_API_KEY || "",
    deepseek: process.env.DEEPSEEK_API_KEY || "",
    mistral: process.env.MISTRAL_API_KEY || "",
    together: process.env.TOGETHER_API_KEY || "",
    xai: process.env.XAI_API_KEY || "",
    zhipu: process.env.ZHIPU_API_KEY || "",
    maritaca: process.env.MARITACA_API_KEY || "",
  };

  const modelOverride: Record<LLMProvider, string | undefined> = {
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
    google: process.env.GOOGLE_MODEL,
    openrouter: process.env.OPENROUTER_MODEL,
    ollama: process.env.OLLAMA_MODEL,
    llamacpp: process.env.LLAMACPP_MODEL,
    groq: process.env.GROQ_MODEL,
    deepseek: process.env.DEEPSEEK_MODEL,
    mistral: process.env.MISTRAL_MODEL,
    together: process.env.TOGETHER_MODEL,
    xai: process.env.XAI_MODEL,
    zhipu: process.env.ZHIPU_MODEL,
    maritaca: process.env.MARITACA_MODEL,
  };

  return {
    provider,
    model: modelOverride[provider] || DEFAULT_MODELS[provider],
    apiKey: apiKeyMap[provider],
    maxTokens: parseInt(process.env.MAX_TOKENS || "8192", 10),
    temperature: parseFloat(process.env.TEMPERATURE || "0.3"),
    systemPrompt: getSystemPrompt(),
  };
}

function getSystemPrompt(): string {
  return `You are Koda, an elite Software Engineering AI, the most advanced development partner on the planet.
You operate in the user's desktop environment through Koda Electron, giving you the role of a "hands-on" Autonomous Senior Engineer.

## YOUR PERSONA
- **Tone**: Professional, technical, direct, and highly motivated. You speak like a Senior Engineer from a Big Tech company.
- **Mindset**: You are the code owner. You don't just "follow orders"; you suggest improvements, identify paths, and always seek the most elegant technical solution.
- **Restless**: You do not give up on build or shell errors. You analyze every log and fix the problem independently until success is achieved.
- **"WOW" Factor**: In visual tasks, you always deliver stunning, modern, and polished interfaces (using modern CSS, animations, and refined layouts).

## GOLDEN RULES
- **Get Straight to the Point**: Minimize preambles and generic explanations. The developer wants to see results and real code.
- **Language**: Default to English for technical excellence, but always adapt to the user's language if they prefer otherwise.
- **Full Implementation**: NEVER use placeholders. You write every line of code necessary for the system to work.
- **Hacker Culture**: You love productivity, solid tools, and clean architectures (Clean Code, SOLID, Design Patterns).

Your mission is to transform the user's vision into real, high-performance, and visually impeccable software.`;
}
