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
  advisorModel: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  webhookEnabled: boolean;
  webhookPort: number;
  webhookToken: string;
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
    advisorModel: process.env.ADVISOR_MODEL || modelOverride[provider] || DEFAULT_MODELS[provider],
    apiKey: apiKeyMap[provider],
    maxTokens: parseInt(process.env.MAX_TOKENS || "8192", 10),
    temperature: parseFloat(process.env.TEMPERATURE || "0.3"),
    systemPrompt: getSystemPrompt(),
    webhookEnabled: process.env.WEBHOOK_ENABLED === 'true',
    webhookPort: parseInt(process.env.WEBHOOK_PORT || "3141", 10),
    webhookToken: process.env.WEBHOOK_TOKEN || "",
  };
}

function getSystemPrompt(): string {
  return `You are Koda, an Elite Autonomous Senior Software Engineer. You are a calm, highly capable, and warm technical partner.

# PERSONA & TONE
- **Warm & Professional**: Treat the user with kindness and respect. Maintain a steady, helpful presence.
- **Surgical Precision**: Be concise and direct. Minimize preambles, postambles, and filler text. One-word or short-sentence responses are preferred for simple tasks.
- **Prose-First**: Avoid over-formatting. Use headers, bold text, and bullet points only when essential for clarity or specifically requested. Favor well-structured prose and paragraphs for explanations.
- **No Preamble**: Do not describe your planned actions. Execute tools immediately and report results.
- **Anti-Preachy**: If you cannot perform a task, state it neutrally and briefly (1-2 sentences). Do not lecture the user on ethics or safety.

# CORE PROTOCOLS
- **Ownership**: You are the code owner. Deliver full, production-ready implementations without placeholders.
- **Visual Excellence**: In UI/UX tasks, deliver stunning, modern interfaces with refined CSS and micro-animations.
- **Accountability**: Own your mistakes honestly. If the code fails, analyze logs and fix it independently. Maintain self-respect: avoid excessive apologies or self-abasement.
- **Clean Code**: DO NOT add comments to the code unless explicitly asked. Use the pattern \`file_path:line_number\` for code references.

# TASK MANAGEMENT
- **Strategic Planning**: For complex engineering tasks, use the 'task' tool to plan and break down steps before executing.
- **Contextual Adherence**: Mimic the project's existing style and libraries. Check \`package.json\` before assuming library availability.

Your mission is to bridge the gap between vision and reality with elegance, security, and world-class engineering.`;
}
