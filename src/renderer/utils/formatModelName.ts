const known: Record<string, string> = {
  // Anthropic
  'claude-opus-4-5':                        'Claude Opus 4.5',
  'claude-opus-4':                          'Claude Opus 4',
  'claude-sonnet-4-5':                      'Claude Sonnet 4.5',
  'claude-sonnet-4':                        'Claude Sonnet 4',
  'claude-sonnet-4-20250514':               'Claude Sonnet 4',
  'claude-3-7-sonnet-20250219':             'Claude 3.7 Sonnet',
  'claude-3-5-sonnet-20241022':             'Claude 3.5 Sonnet',
  'claude-3-5-haiku-20241022':              'Claude 3.5 Haiku',
  'claude-3-opus-20240229':                 'Claude 3 Opus',
  'claude-3-sonnet-20240229':               'Claude 3 Sonnet',
  'claude-3-haiku-20240307':                'Claude 3 Haiku',
  // OpenAI
  'gpt-4o':                                 'GPT-4o',
  'gpt-4o-mini':                            'GPT-4o Mini',
  'gpt-4-turbo':                            'GPT-4 Turbo',
  'gpt-4':                                  'GPT-4',
  'gpt-3.5-turbo':                          'GPT-3.5 Turbo',
  'o1':                                     'o1',
  'o1-mini':                                'o1 Mini',
  'o1-preview':                             'o1 Preview',
  'o3':                                     'o3',
  'o3-mini':                                'o3 Mini',
  'o4-mini':                                'o4 Mini',
  // Google
  'gemini-2.5-pro':                         'Gemini 2.5 Pro',
  'gemini-2.5-flash':                       'Gemini 2.5 Flash',
  'gemini-2.0-flash':                       'Gemini 2.0 Flash',
  'gemini-2.0-flash-exp':                   'Gemini 2.0 Flash Exp',
  'gemini-1.5-pro':                         'Gemini 1.5 Pro',
  'gemini-1.5-flash':                       'Gemini 1.5 Flash',
  // DeepSeek
  'deepseek-chat':                          'DeepSeek Chat',
  'deepseek-coder':                         'DeepSeek Coder',
  'deepseek-reasoner':                      'DeepSeek Reasoner',
  // Groq
  'llama-3.3-70b-versatile':                'Llama 3.3 70B',
  'llama3-70b-8192':                        'Llama 3 70B',
  'llama3-8b-8192':                         'Llama 3 8B',
  'mixtral-8x7b-32768':                     'Mixtral 8x7B',
  'gemma2-9b-it':                           'Gemma 2 9B',
  // Mistral
  'mistral-large-latest':                   'Mistral Large',
  'mistral-medium-latest':                  'Mistral Medium',
  'mistral-small-latest':                   'Mistral Small',
  'codestral-latest':                       'Codestral',
  // xAI
  'grok-beta':                              'Grok Beta',
  'grok-2':                                 'Grok 2',
  // Together
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': 'Llama 3.3 70B Turbo',
  'meta-llama/Llama-3-70b-chat-hf':         'Llama 3 70B',
  // Maritaca
  'sabia-3':                                'Sabiá 3',
  'sabia-4':                                'Sabiá 4',
  // Zhipu
  'glm-4-flash':                            'GLM-4 Flash',
  'glm-5':                                  'GLM-5',
  // Ollama / local
  'llama3':                                 'Llama 3',
  'llama3:8b':                              'Llama 3 8B',
  'llama3:70b':                             'Llama 3 70B',
  'local-model':                            'Local Model',
}

export function formatModelName(id: string): string {
  if (known[id]) return known[id]

  return id
    .split('/')
    .pop()!
    .replace(/-/g, ' ')
    .replace(/\b(\w)/g, (c) => c.toUpperCase())
    .replace(/\b(\d+)b\b/gi, '$1B')
}
