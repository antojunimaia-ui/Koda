import { KodaTheme } from '../types/index.js'
import tokyoNight from '../themes/tokyo-night.json'

const DEFAULT_THEME = tokyoNight as KodaTheme

// Definição dos Schemas de Dados do KoDB
export interface KoDBSchema {
  theme: KodaTheme
  provider: string
  apiKey: string
  model: string
  advisorModel: string
  providersConfig: Record<string, { apiKey: string, model: string, advisorModel: string }>
}

export interface DBMetadata {
  id: string
  name: string
  category: 'Appearance' | 'Settings' | 'API' | 'General'
  description: string
}

// Mapeamento de metadados e valores padrões para cada chave do banco
export const KODB_METADATA: Record<keyof KoDBSchema, DBMetadata & { defaultValue: any }> = {
  theme: {
    id: 'koda_theme',
    name: 'Theme',
    category: 'Appearance',
    description: 'The active interface theme color scheme',
    defaultValue: DEFAULT_THEME,
  },
  provider: {
    id: 'koda_provider',
    name: 'Active Provider',
    category: 'API',
    description: 'The currently active LLM provider',
    defaultValue: 'openai',
  },
  apiKey: {
    id: 'koda_api_key',
    name: 'API Key',
    category: 'API',
    description: 'The API key for the active provider',
    defaultValue: '',
  },
  model: {
    id: 'koda_model',
    name: 'Active Model',
    category: 'API',
    description: 'The primary model name for the active provider',
    defaultValue: 'gpt-4o',
  },
  advisorModel: {
    id: 'koda_advisor_model',
    name: 'Advisor Model',
    category: 'API',
    description: 'The advisor model name for the active provider',
    defaultValue: 'gpt-4o',
  },
  providersConfig: {
    id: 'koda_providers_config',
    name: 'Providers Configurations',
    category: 'API',
    description: 'Stored configurations (keys, models) for all providers',
    defaultValue: {},
  },
}

class KoDBService {
  /**
   * Obtém um valor do banco pelo identificador tipado.
   */
  get<K extends keyof KoDBSchema>(key: K): KoDBSchema[K] {
    const meta = KODB_METADATA[key]
    try {
      const saved = localStorage.getItem(meta.id)
      if (saved) {
        return JSON.parse(saved) as KoDBSchema[K]
      }
    } catch (e) {
      console.error(`[KoDB] Error reading key "${key}" from localStorage:`, e)
    }
    return meta.defaultValue as KoDBSchema[K]
  }

  /**
   * Salva um valor no banco pelo identificador tipado.
   */
  set<K extends keyof KoDBSchema>(key: K, value: KoDBSchema[K]): void {
    const meta = KODB_METADATA[key]
    try {
      localStorage.setItem(meta.id, JSON.stringify(value))
      // Dispara um CustomEvent para permitir listeners reativos se necessário no futuro
      window.dispatchEvent(new CustomEvent(`kodb_change:${key}`, { detail: value }))
    } catch (e) {
      console.error(`[KoDB] Error writing key "${key}" to localStorage:`, e)
    }
  }

  /**
   * Inscreve-se a mudanças de uma determinada chave. Retorna função de unsubscribe.
   */
  subscribe<K extends keyof KoDBSchema>(key: K, callback: (value: KoDBSchema[K]) => void): () => void {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<KoDBSchema[K]>
      callback(customEvent.detail)
    }
    window.addEventListener(`kodb_change:${key}`, handler)
    return () => {
      window.removeEventListener(`kodb_change:${key}`, handler)
    }
  }
}

export const KoDB = new KoDBService()
