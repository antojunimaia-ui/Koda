import React, { useState, useEffect, useRef } from 'react'
import { Check, Key, Palette, Cpu, Users, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react'
import { KodaTheme } from '../../types/index.js'
import { THEMES } from '../settings/SettingsUI.js'
import { formatModelName } from '../../utils/formatModelName.js'

interface WelcomeWizardModalProps {
  currentTheme: KodaTheme
  setTheme: React.Dispatch<React.SetStateAction<KodaTheme>>
  onComplete: (config: { provider: string; model: string; advisorModel: string; apiKey: string; theme: KodaTheme }) => void
  loadedModels: Record<string, string[] | undefined>
  fetchModelsForProvider: (provId: string, apiKey: string) => Promise<void>
}

const PROVIDERS = [
  { 
    id: 'koda-cloud', 
    name: 'Koda Cloud', 
    description: 'Ready to use, no API Key required.', 
    recommended: true,
    requiresKey: false, 
    defaultModel: 'gemini-1.5-flash',
    defaultAdvisorModel: 'gemini-1.5-flash',
    popularModels: ['gemini-1.5-flash', 'gemini-1.5-pro']
  },
  { 
    id: 'google', 
    name: 'Google Gemini', 
    description: 'Gemini 1.5 Flash and Pro models from Google.', 
    requiresKey: true, 
    placeholder: 'AIzaSy...',
    defaultModel: 'gemini-1.5-flash',
    defaultAdvisorModel: 'gemini-1.5-pro',
    popularModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
  },
  { 
    id: 'openai', 
    name: 'OpenAI', 
    description: 'GPT-4o and GPT-4o-mini models from OpenAI.', 
    requiresKey: true, 
    placeholder: 'sk-proj-...',
    defaultModel: 'gpt-4o',
    defaultAdvisorModel: 'gpt-4o',
    popularModels: ['gpt-4o', 'gpt-4o-mini', 'o1-mini']
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic Claude', 
    description: 'Claude 3.5 Sonnet for reasoning and code engineering.', 
    requiresKey: true, 
    placeholder: 'sk-ant-...',
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultAdvisorModel: 'claude-3-5-sonnet-20241022',
    popularModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
  },
  { 
    id: 'openrouter', 
    name: 'OpenRouter', 
    description: 'Unified access to dozens of AI models.', 
    requiresKey: true, 
    placeholder: 'sk-or-v1-...',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    defaultAdvisorModel: 'anthropic/claude-3.5-sonnet',
    popularModels: ['google/gemini-2.0-flash-exp:free', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat']
  },
  { 
    id: 'deepseek', 
    name: 'DeepSeek', 
    description: 'High-performance DeepSeek R1 and V3 models.', 
    requiresKey: true, 
    placeholder: 'sk-...',
    defaultModel: 'deepseek-chat',
    defaultAdvisorModel: 'deepseek-reasoner',
    popularModels: ['deepseek-chat', 'deepseek-reasoner']
  },
  { 
    id: 'groq', 
    name: 'Groq (Ultra Fast)', 
    description: 'Ultra-low latency inference with Llama 3.', 
    requiresKey: true, 
    placeholder: 'gsk_...',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultAdvisorModel: 'llama-3.3-70b-versatile',
    popularModels: ['llama-3.3-70b-versatile', 'llama3-8b-8192']
  },
  { 
    id: 'ollama', 
    name: 'Ollama (Local)', 
    description: 'Run 100% local models directly on your machine.', 
    requiresKey: false, 
    placeholder: 'Optional (if using proxy with auth)',
    defaultModel: 'llama3',
    defaultAdvisorModel: 'llama3',
    popularModels: ['llama3', 'qwen2.5-coder', 'deepseek-r1']
  }
]

export const WelcomeWizardModal: React.FC<WelcomeWizardModalProps> = ({
  currentTheme,
  setTheme,
  onComplete,
  loadedModels,
  fetchModelsForProvider,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  
  const [selectedTheme, setSelectedTheme] = useState<KodaTheme>(currentTheme || THEMES[0])
  const [provider, setProvider] = useState<string>('koda-cloud')
  const [apiKey, setApiKey] = useState<string>('')
  const [model, setModel] = useState<string>('gemini-1.5-flash')
  const [advisorModel, setAdvisorModel] = useState<string>('gemini-1.5-flash')
  const fetchedRef = useRef<Set<string>>(new Set())

  // Dispara o fetch uma única vez ao entrar nas etapas que exibem modelos
  useEffect(() => {
    if (step < 3) return
    const key = `${provider}::${apiKey}`
    if (fetchedRef.current.has(key)) return
    fetchedRef.current.add(key)
    fetchModelsForProvider(provider, apiKey)
  }, [step, provider, apiKey, fetchModelsForProvider])

  const handleSelectTheme = (t: KodaTheme) => {
    setSelectedTheme(t)
    setTheme(t)
  }

  const handleSelectProvider = (provId: string) => {
    setProvider(provId)
    const provInfo = PROVIDERS.find(p => p.id === provId)
    if (provInfo) {
      setModel(provInfo.defaultModel)
      setAdvisorModel(provInfo.defaultAdvisorModel)
    }
  }

  const selectedProvObj = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]
  // Usa modelos carregados via API; cai para os popularModels estáticos como fallback
  const availableModels = loadedModels[provider] ?? selectedProvObj.popularModels

  const handleFinish = () => {
    onComplete({
      provider,
      model,
      advisorModel: advisorModel || model,
      apiKey: selectedProvObj.requiresKey ? apiKey : '',
      theme: selectedTheme
    })
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-[#09090b] text-zinc-100 flex flex-col justify-between select-none overflow-hidden animate-fadeIn">
      
      {/* Topo / Header em Tela Cheia */}
      <header className="w-full px-8 py-6 border-b border-white/10 bg-neutral-900/40 flex items-center justify-center">
        {/* Stepper Progress */}
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: 'Theme', icon: Palette },
            { num: 2, label: 'Provider & API', icon: Key },
            { num: 3, label: 'Default Model', icon: Cpu },
            { num: 4, label: 'Collab Model', icon: Users }
          ].map(s => {
            const active = step === s.num
            const done = step > s.num
            return (
              <button 
                key={s.num}
                disabled={!done && !active}
                onClick={() => { if (done) setStep(s.num as any) }}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                  active 
                    ? 'bg-white/10 border-white/25 text-white' 
                    : done 
                      ? 'bg-white/5 border-white/10 text-zinc-300 hover:border-white/20 cursor-pointer' 
                      : 'bg-transparent border-transparent text-zinc-600'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                  done ? 'bg-white text-black' : active ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-600'
                }`}>
                  {done ? <Check className="w-3 h-3 stroke-[3]" /> : s.num}
                </div>
                <span className="truncate font-semibold">{s.label}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Conteúdo Centralizado de Tela Cheia */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 flex flex-col justify-center overflow-y-auto custom-scrollbar">
        
        {/* PASSO 1: Tema Visual */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Palette className="w-5 h-5" />
                Choose Your Visual Theme
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5">
                Select the color palette applied to the Koda interface in real time.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              {THEMES.map((t) => {
                const isSelected = selectedTheme.name === t.name
                return (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTheme(t)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'bg-white/10 border-white/40 ring-1 ring-white/20 text-white scale-[1.02]'
                        : 'bg-neutral-900/60 border-white/5 hover:bg-white/5 hover:border-white/15 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-100">{t.name}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl border border-white/10 bg-black/60 flex items-center justify-around">
                      <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.bg }} title="BG" />
                      <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.sidebar }} title="Sidebar" />
                      <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.accent }} title="Accent" />
                      <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.text }} title="Text" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 2: Provedor & API Key */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto w-full">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Key className="w-5 h-5" />
                AI Provider
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5">
                Choose to use <strong>Koda Cloud for free</strong> with no setup, or connect your own API key.
              </p>
            </div>

            {/* Card Destaque Koda Cloud */}
            <div 
              onClick={() => handleSelectProvider('koda-cloud')}
              className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                provider === 'koda-cloud'
                  ? 'bg-white/10 border-white/40 ring-1 ring-white/20 text-white'
                  : 'bg-neutral-900/60 border-white/5 hover:border-white/20 text-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">Koda Cloud</span>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/15">
                    Recommended / No API Key
                  </span>
                </div>
                {provider === 'koda-cloud' && <Check className="w-5 h-5 text-white" />}
              </div>
            </div>

            <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest pt-2">
              Or choose another provider:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROVIDERS.filter(p => p.id !== 'koda-cloud').map((p) => {
                const isSelected = provider === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProvider(p.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-white/10 border-white/40 text-white' 
                        : 'bg-neutral-900/40 border-white/5 hover:border-white/15 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-zinc-200">{p.name}</div>
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Campo para API Key */}
            {selectedProvObj.requiresKey && (
              <div className="pt-2 animate-fadeIn">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  API Key ({selectedProvObj.name}):
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedProvObj.placeholder || 'Paste your API Key here...'}
                  className="w-full px-4 py-3 text-xs bg-neutral-900 border border-white/15 rounded-xl text-white placeholder-zinc-600 outline-none focus:border-white/40 font-mono transition-colors"
                />
              </div>
            )}
          </div>
        )}

        {/* PASSO 3: Modelo Padrão */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn max-w-xl mx-auto w-full">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Cpu className="w-5 h-5" />
                Default Model (Primary Agent)
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5">
                This is the main model responsible for executing commands, reading files, and writing code.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {availableModels.map((m) => {
                const isSel = model === m
                return (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`group w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                      isSel 
                        ? 'bg-white/10 border-white/30 text-white font-medium' 
                        : 'bg-neutral-900/40 border-white/5 hover:border-white/15 text-zinc-400'
                    }`}
                  >
                    <span className="text-[11px] font-medium truncate">{formatModelName(m)}</span>
                    <span className="text-[9px] font-mono text-zinc-600 truncate hidden group-hover:block">{m}</span>
                    {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 4: Modelo Collab */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn max-w-xl mx-auto w-full">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                Collab Model (Advisor)
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5">
                Model used in collaboration mode to validate decisions and code architecture.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {availableModels.map((m) => {
                const isSel = advisorModel === m
                return (
                  <button
                    key={m}
                    onClick={() => setAdvisorModel(m)}
                    className={`group w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                      isSel 
                        ? 'bg-white/10 border-white/30 text-white font-medium' 
                        : 'bg-neutral-900/40 border-white/5 hover:border-white/15 text-zinc-400'
                    }`}
                  >
                    <span className="text-[11px] font-medium truncate">{formatModelName(m)}</span>
                    <span className="text-[9px] font-mono text-zinc-600 truncate hidden group-hover:block">{m}</span>
                    {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </main>

      {/* Rodapé Fixo Inferior em Tela Cheia */}
      <footer className="w-full px-8 py-5 border-t border-white/10 bg-neutral-900/50 flex items-center justify-between">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as any)}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as any)}
            className="px-6 py-2.5 text-xs font-bold rounded-xl bg-white text-black hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-md active:scale-95"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="px-7 py-3 text-xs font-bold rounded-xl bg-white text-black hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-lg active:scale-95"
          >
            Finish & Launch Koda
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </footer>

    </div>
  )
}
