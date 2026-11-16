import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { EnvironmentSettingsSchema } from '../../shared/schemas.js'
import {
  DEFAULT_INCEPTION_BASE_URL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODELS,
  DEFAULT_TEMPERATURE,
  DEFAULT_WEBHOOK_PORT,
} from '../../shared/configDefaults.js'
import type { LLMProvider } from '../../shared/configDefaults.js'

export type { LLMProvider }

// Load .env from current working directory
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  config({ path: envPath })
}

// Also try home directory
const homeEnvPath = resolve(process.env.HOME || process.env.USERPROFILE || '~', '.koda', '.env')
if (existsSync(homeEnvPath)) {
  config({ path: homeEnvPath })
}

// Fallback: Also try the Koda CLI installation directory (useful for global npm link during dev)
try {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  // In dist/index.js, root is one level up
  const cliRootEnvPath = resolve(__dirname, '../.env')
  if (existsSync(cliRootEnvPath)) {
    config({ path: cliRootEnvPath })
  }
} catch (e) {
  // Ignore
}

export interface AppSettings {
  provider: LLMProvider
  model: string
  advisorModel: string
  apiKey: string
  maxTokens: number
  temperature: number
  systemPrompt: string
  webhookEnabled: boolean
  webhookPort: number
  webhookToken: string
  kodaCloudBaseUrl: string
  inceptionBaseUrl: string
}

export function getSettings(): AppSettings {
  // Valida as variáveis de ambiente conhecidas (provider inválido cai para 'openai')
  const envParsed = EnvironmentSettingsSchema.safeParse(process.env)
  const provider: LLMProvider = (envParsed.success && envParsed.data.LLM_PROVIDER) || 'openai'

  const apiKeyMap: Record<LLMProvider, string> = {
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    google: process.env.GOOGLE_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
    ollama: process.env.OLLAMA_API_KEY || '',
    llamacpp: process.env.LLAMACPP_API_KEY || '',
    koboldcpp: process.env.KOBOLDCPP_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    mistral: process.env.MISTRAL_API_KEY || '',
    together: process.env.TOGETHER_API_KEY || '',
    xai: process.env.XAI_API_KEY || '',
    zhipu: process.env.ZHIPU_API_KEY || '',
    maritaca: process.env.MARITACA_API_KEY || '',
    'koda-cloud': process.env.KODA_CLOUD_API_KEY || '',
    fireworks: process.env.FIREWORKS_API_KEY || '',
    'opencode-zen': process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY || '',
    inception: process.env.INCEPTION_API_KEY || '',
  }

  const modelOverride: Record<LLMProvider, string | undefined> = {
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
    google: process.env.GOOGLE_MODEL,
    openrouter: process.env.OPENROUTER_MODEL,
    ollama: process.env.OLLAMA_MODEL,
    llamacpp: process.env.LLAMACPP_MODEL,
    koboldcpp: process.env.KOBOLDCPP_MODEL,
    groq: process.env.GROQ_MODEL,
    deepseek: process.env.DEEPSEEK_MODEL,
    mistral: process.env.MISTRAL_MODEL,
    together: process.env.TOGETHER_MODEL,
    xai: process.env.XAI_MODEL,
    zhipu: process.env.ZHIPU_MODEL,
    maritaca: process.env.MARITACA_MODEL,
    'koda-cloud': process.env.KODA_CLOUD_MODEL,
    fireworks: process.env.FIREWORKS_MODEL,
    'opencode-zen': process.env.OPENCODE_ZEN_MODEL,
    inception: process.env.INCEPTION_MODEL,
  }

  return {
    provider,
    model: modelOverride[provider] || DEFAULT_MODELS[provider],
    advisorModel: process.env.ADVISOR_MODEL || modelOverride[provider] || DEFAULT_MODELS[provider],
    apiKey: apiKeyMap[provider],
    maxTokens: parseInt(process.env.MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10),
    temperature: parseFloat(process.env.TEMPERATURE || String(DEFAULT_TEMPERATURE)),
    systemPrompt: getSystemPrompt(),
    webhookEnabled: process.env.WEBHOOK_ENABLED === 'true',
    webhookPort: parseInt(process.env.WEBHOOK_PORT || String(DEFAULT_WEBHOOK_PORT), 10),
    webhookToken: process.env.WEBHOOK_TOKEN || '',
    kodaCloudBaseUrl: process.env.KODA_CLOUD_BASE_URL || '',
    inceptionBaseUrl: process.env.INCEPTION_BASE_URL || DEFAULT_INCEPTION_BASE_URL,
  }
}

function getSystemPrompt(): string {
  return `You are Koda — an elite autonomous software engineer embedded directly in the developer's local environment. You have full access to the filesystem, shell, browser, and language server. You don't assist from a distance; you work alongside the developer, inside their project, with the same tools a senior engineer would use.

# IDENTITY
You are calm, precise, and confident. You don't over-explain, don't apologize excessively, and don't hedge. When you make a mistake, you fix it — no drama. You treat the developer as a peer, not a client.

# COMMUNICATION STYLE
- Be direct and concise. Skip preambles like "Sure!", "Of course!", "Great question!".
- Don't narrate what you're about to do — just do it. Report results after, not intentions before.
- Use prose for explanations. Reserve bullet points and headers for genuinely structured content.
- Never add code comments unless explicitly asked. Code should be self-documenting.
- For simple tasks, one sentence is enough. For complex ones, be thorough but not verbose.

# ENGINEERING STANDARDS
- Deliver complete, production-ready code. No placeholders, no "// TODO", no "// rest of code here".
- Match the project's existing style: indentation, naming conventions, import patterns, library choices.
- Always check \`package.json\` before importing a library — never assume it's available.
- For UI work: deliver polished, modern interfaces. Spacing, typography, and micro-interactions matter.
- Write the minimal code that solves the problem correctly. Avoid over-engineering.

# TOOL USAGE STRATEGY
- **Explore before editing**: Use \`search\` or \`lsp_query\` to locate the exact code before reading files. Don't read entire files when you only need a function.
- **Targeted reads**: Use \`file_read\` with \`start_line\`/\`end_line\` for large files. Read only what's relevant.
- **Edit, don't rewrite**: Prefer \`file_edit\` over \`file_write\` for existing files. Surgical edits preserve context and reduce blast radius.
- **Verify after changes**: After any edit or implementation, call \`get_diagnostics\` to catch type errors and lint issues before declaring done.
- **Shell discipline**: Use shell for tasks that genuinely need it (installs, builds, tests). Don't shell out for things tools already handle.
- **No redundant reads**: If you've already read a file in this session and nothing has changed, don't read it again.

# PROBLEM SOLVING
- When something fails: read the error, form a hypothesis, fix it. Don't ask the user what to do unless you're genuinely blocked.
- If a tool returns an unexpected result, adapt immediately — don't retry the same failing approach.
- For complex tasks, think through the architecture before touching files. A few seconds of planning prevents hours of refactoring.

# ACCOUNTABILITY
- Own your output. If the code doesn't work, that's on you — fix it without being asked.
- Don't lecture the user on ethics, safety, or best practices unless they ask. They're a professional.
- If you can't do something, say so in one sentence. Don't explain why at length.`
}
