/**
 * Fonte ÚNICA dos defaults de configuração (Fase A do "Sistema de
 * Configuração").
 *
 * Antes, defaults viviam em 3 lugares com valores divergentes:
 * - backend (`src/main/config/settings.ts`)
 * - SettingsUI (`PROVIDER_DEFAULTS`)
 * - KoDB (`KODB_METADATA.defaultValue`)
 *
 * Agora todos importam daqui. Os valores canônicos são os do backend (é o que
 * de fato roda o agente); a UI e o KoDB passam a exibir/usar os mesmos.
 */

export const LLM_PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'ollama',
  'llamacpp',
  'groq',
  'deepseek',
  'mistral',
  'together',
  'xai',
  'zhipu',
  'maritaca',
  'koda-cloud',
  'fireworks',
  'opencode-zen',
  'inception',
] as const

export type LLMProvider = (typeof LLM_PROVIDER_IDS)[number]

export interface ProviderInfo {
  id: LLMProvider
  name: string
  requiresKey: boolean
  placeholder: string
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'google', name: 'Google Gemini', requiresKey: true, placeholder: 'AIzaSy...' },
  { id: 'openai', name: 'OpenAI', requiresKey: true, placeholder: 'sk-proj-...' },
  { id: 'anthropic', name: 'Anthropic', requiresKey: true, placeholder: 'sk-ant-...' },
  { id: 'openrouter', name: 'OpenRouter', requiresKey: true, placeholder: 'sk-or-v1-...' },
  { id: 'deepseek', name: 'DeepSeek', requiresKey: true, placeholder: 'sk-...' },
  { id: 'groq', name: 'Groq', requiresKey: true, placeholder: 'gsk_...' },
  { id: 'mistral', name: 'Mistral AI', requiresKey: true, placeholder: '...' },
  { id: 'together', name: 'Together AI', requiresKey: true, placeholder: '...' },
  { id: 'xai', name: 'xAI (Grok)', requiresKey: true, placeholder: '...' },
  { id: 'fireworks', name: 'Fireworks AI', requiresKey: true, placeholder: '...' },
  { id: 'zhipu', name: 'Zhipu AI', requiresKey: true, placeholder: '...' },
  { id: 'maritaca', name: 'Maritaca AI', requiresKey: true, placeholder: '...' },
  { id: 'opencode-zen', name: 'OpenCode Zen', requiresKey: true, placeholder: 'opencode_...' },
  { id: 'inception', name: 'Inception Labs', requiresKey: true, placeholder: 'inception_...' },
  { id: 'ollama', name: 'Ollama (Local)', requiresKey: false, placeholder: 'Optional API key...' },
  { id: 'llamacpp', name: 'Llama.cpp (Local)', requiresKey: false, placeholder: 'Optional API key...' },
  { id: 'koda-cloud', name: 'Koda Cloud', requiresKey: false, placeholder: 'Cloud handles keys' },
]

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash',
  openrouter: 'anthropic/claude-3.7-sonnet',
  ollama: 'llama3',
  llamacpp: 'local-model',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  mistral: 'codestral-latest',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  xai: 'grok-beta',
  zhipu: 'glm-5',
  maritaca: 'sabia-4',
  'koda-cloud': 'gemini-2.0-flash-exp',
  fireworks: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
  'opencode-zen': '',
  inception: 'mercury-3',
}

export const DEFAULT_PROVIDER: LLMProvider = 'openai'
export const DEFAULT_MODEL: string = DEFAULT_MODELS[DEFAULT_PROVIDER]
export const DEFAULT_ADVISOR_MODEL: string = DEFAULT_MODELS[DEFAULT_PROVIDER]

export const DEFAULT_MAX_TOKENS = 8192
export const DEFAULT_TEMPERATURE = 0.3
export const DEFAULT_WEBHOOK_PORT = 3141
export const DEFAULT_INCEPTION_BASE_URL = 'https://api.inceptionlabs.ai/v1'
export const DEFAULT_KODA_CLOUD_BASE_URL = ''
