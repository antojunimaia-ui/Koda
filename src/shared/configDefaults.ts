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

export type ProviderKind = 'remote' | 'local'
export type ProviderCredential = 'apiKey' | 'baseUrl' | 'none'

export interface ProviderInfo {
  id: LLMProvider
  name: string
  /** Provider remoto (requer API key) ou local (endpoint na máquina). */
  kind: ProviderKind
  /** Como a UI coleta a credencial do provider. */
  credential: ProviderCredential
  requiresKey: boolean
  placeholder: string
  /** URL base padrão (útil para providers locais e Koda Cloud). */
  defaultBaseUrl?: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'remote',
    credential: 'apiKey',
    requiresKey: true,
    placeholder: 'AIzaSy...',
  },
  { id: 'openai', name: 'OpenAI', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: 'sk-proj-...' },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'remote',
    credential: 'apiKey',
    requiresKey: true,
    placeholder: 'sk-ant-...',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'remote',
    credential: 'apiKey',
    requiresKey: true,
    placeholder: 'sk-or-v1-...',
  },
  { id: 'deepseek', name: 'DeepSeek', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: 'sk-...' },
  { id: 'groq', name: 'Groq', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: 'gsk_...' },
  { id: 'mistral', name: 'Mistral AI', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: '...' },
  { id: 'together', name: 'Together AI', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: '...' },
  { id: 'xai', name: 'xAI (Grok)', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: '...' },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    kind: 'remote',
    credential: 'apiKey',
    requiresKey: true,
    placeholder: '...',
  },
  { id: 'zhipu', name: 'Zhipu AI', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: '...' },
  { id: 'maritaca', name: 'Maritaca AI', kind: 'remote', credential: 'apiKey', requiresKey: true, placeholder: '...' },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    kind: 'remote',
    credential: 'apiKey',
    requiresKey: true,
    placeholder: 'opencode_...',
  },
  {
    id: 'inception',
    name: 'Inception Labs',
    kind: 'remote',
    credential: 'apiKey',
    requiresKey: true,
    placeholder: 'inception_...',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    kind: 'local',
    credential: 'apiKey',
    requiresKey: false,
    placeholder: 'Optional API key...',
    defaultBaseUrl: 'http://localhost:11434',
  },
  {
    id: 'llamacpp',
    name: 'Llama.cpp (Local)',
    kind: 'local',
    credential: 'apiKey',
    requiresKey: false,
    placeholder: 'Optional API key...',
    defaultBaseUrl: 'http://localhost:8080',
  },
  {
    id: 'koda-cloud',
    name: 'Koda Cloud',
    kind: 'remote',
    credential: 'baseUrl',
    requiresKey: false,
    placeholder: 'Cloud handles keys',
    defaultBaseUrl: '',
  },
]

/** Retorna o registro de um provider pelo id (undefined se não existir). */
export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

/** Providers que não exigem API key (locais ou gerenciados). */
export const NO_KEY_PROVIDERS: LLMProvider[] = PROVIDERS.filter((p) => !p.requiresKey).map((p) => p.id)

/** Providers locais (inferência na máquina do usuário). */
export const LOCAL_PROVIDERS: ProviderInfo[] = PROVIDERS.filter((p) => p.kind === 'local')

/** Providers remotos (exigem API key). */
export const REMOTE_PROVIDERS: ProviderInfo[] = PROVIDERS.filter((p) => p.kind === 'remote')

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
