import React, { useState, useEffect, useRef } from 'react'
import { Check, Key, Palette, Cpu, Users, ChevronRight, ChevronLeft, ArrowRight, ShieldAlert, X } from 'lucide-react'
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
    id: 'opencode-zen', 
    name: 'OpenCode Zen', 
    description: 'Curated AI gateway optimized for coding agents.', 
    requiresKey: true, 
    placeholder: 'opencode_...',
    defaultModel: '',
    defaultAdvisorModel: '',
    popularModels: []
  },
  { 
    id: 'google', 
    name: 'Google Gemini', 
    description: 'Gemini Flash and Pro models from Google.', 
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
    name: 'Groq', 
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

const STEPS = [
  { num: 1, label: 'Theme',    icon: Palette },
  { num: 2, label: 'Provider', icon: Key     },
  { num: 3, label: 'Model',    icon: Cpu     },
  { num: 4, label: 'Advisor',  icon: Users   },
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
  const [kodaCloudBaseUrl, setKodaCloudBaseUrl] = useState<string>('http://cn-01.hostzera.com.br:2137')
  const [kodaCloudAccepted, setKodaCloudAccepted] = useState<boolean>(false)
  const [showKodaCloudModal, setShowKodaCloudModal] = useState<boolean>(false)
  const fetchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (step < 3) return
    const keyToUse = provider === 'koda-cloud' ? kodaCloudBaseUrl : apiKey
    const key = `${provider}::${keyToUse}`
    if (fetchedRef.current.has(key)) return
    fetchedRef.current.add(key)
    fetchModelsForProvider(provider, keyToUse)
  }, [step, provider, apiKey, kodaCloudBaseUrl, fetchModelsForProvider])

  const handleSelectTheme = (t: KodaTheme) => {
    setSelectedTheme(t)
    setTheme(t)
  }

  const handleSelectProvider = (provId: string) => {
    setProvider(provId)
    const prov = PROVIDERS.find(p => p.id === provId)
    if (prov) {
      setModel(prov.defaultModel)
      setAdvisorModel(prov.defaultAdvisorModel)
    }
    setApiKey('')
  }

  const selectedProvObj = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]
  const availableModels = loadedModels[provider] ?? selectedProvObj.popularModels

  const handleContinue = () => {
    if (step === 2 && provider === 'koda-cloud' && !kodaCloudAccepted) {
      setShowKodaCloudModal(true)
      return
    }
    if (step < 4) {
      setStep((s) => (s + 1) as any)
    }
  }

  const handleFinish = () => {
    onComplete({
      provider,
      model,
      advisorModel: advisorModel || model,
      apiKey: selectedProvObj.requiresKey ? apiKey : '',
      theme: selectedTheme,
      ...(provider === 'koda-cloud' ? { kodaCloudBaseUrl } : {})
    })
  }

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col font-sans select-none overflow-hidden" style={{ background: '#09090b' }}>

      {/* Titlebar — drag region + window controls only */}
      <div className="titlebar-drag w-full h-8 shrink-0 flex items-center justify-end pr-0 border-b border-white/5">
        <button
          onClick={() => window.koda.minimize()}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors no-drag"
        >
          <svg width="12" height="1" viewBox="0 0 12 1" fill="currentColor"><rect width="12" height="1"/></svg>
        </button>
        <button
          onClick={() => window.koda.maximize()}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors no-drag"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1" y="1" width="8" height="8"/></svg>
        </button>
        <button
          onClick={() => window.koda.close()}
          className="w-11 h-8 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-colors no-drag"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 1L9 9M9 1L1 9"/>
          </svg>
        </button>
      </div>

      {/* Header — Stepper */}
      <header className="relative z-10 w-full px-8 py-4 border-b border-white/5 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-sm bg-white" />
          </div>
          <span className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">Koda</span>
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1.5">
          {STEPS.map(s => {
            const active = step === s.num
            const done   = step > s.num
            return (
              <button
                key={s.num}
                disabled={!done && !active}
                onClick={() => { if (done) setStep(s.num as any) }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  active
                    ? 'bg-white/10 border border-white/15 text-white'
                    : done
                      ? 'text-zinc-400 hover:text-zinc-200 cursor-pointer border border-transparent hover:border-white/5'
                      : 'text-zinc-700 border border-transparent cursor-default'
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  done ? 'bg-white/20 text-white' : active ? 'bg-white/10 text-white' : 'bg-white/5 text-zinc-600'
                }`}>
                  {done ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : s.num}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            )
          })}
        </div>

        <div className="w-24" /> {/* spacer */}
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-6 py-10 flex flex-col justify-center overflow-y-auto custom-scrollbar">

        {/* STEP 1: Theme */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-white tracking-tight">Choose your theme</h2>
              <p className="text-[12px] text-zinc-500">Select a color palette applied to the Koda interface.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEMES.map((t) => {
                const isSelected = selectedTheme.name === t.name
                return (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTheme(t)}
                    className={`group p-3.5 rounded-lg border text-left transition-all flex flex-col gap-3 ${
                      isSelected
                        ? 'bg-white/5 border-white/20 text-white'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-200">{t.name}</span>
                      {isSelected && (
                        <div className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center">
                          <Check className="w-2 h-2 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: t.colors.bg }} />
                      <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: t.colors.sidebar }} />
                      <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: t.colors.accent }} />
                      <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: t.colors.text }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Provider */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-white tracking-tight">AI Provider</h2>
              <p className="text-[12px] text-zinc-500">Choose <span className="text-zinc-300">Koda Cloud</span> for zero setup, or connect your own API key.</p>
            </div>

            {/* Koda Cloud card */}
            <div
              onClick={() => handleSelectProvider('koda-cloud')}
              className={`group p-4 rounded-lg border cursor-pointer transition-all ${
                provider === 'koda-cloud'
                  ? 'bg-white/5 border-white/20 text-white'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-zinc-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold text-zinc-100">Koda Cloud</span>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10">
                    Recommended · Free
                  </span>
                  {provider === 'koda-cloud' && (
                    kodaCloudAccepted ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-white/10 text-zinc-200 border border-white/10">
                        Terms Accepted ✓
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                        Requires Confirmation
                      </span>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {provider === 'koda-cloud' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowKodaCloudModal(true)
                      }}
                      className="text-[10px] font-medium text-zinc-400 hover:text-white underline decoration-white/20 px-1 py-0.5"
                    >
                      {kodaCloudAccepted ? 'Edit Proxy & Terms' : 'View Terms'}
                    </button>
                  )}
                  {provider === 'koda-cloud' && <Check className="w-4 h-4 text-white" />}
                </div>
              </div>
            </div>

            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Or choose another provider</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROVIDERS.filter(p => p.id !== 'koda-cloud').map((p) => {
                const isSelected = provider === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProvider(p.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white/5 border-white/20 text-white'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/8 text-zinc-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-zinc-200">{p.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedProvObj.requiresKey && (
              <div className="pt-1 animate-fadeIn space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-400">
                  API Key — {selectedProvObj.name}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedProvObj.placeholder || 'Paste your API Key...'}
                  className="w-full px-3.5 py-2.5 text-[12px] bg-white/[0.03] border border-white/8 rounded-lg text-white placeholder-zinc-700 outline-none focus:border-white/20 font-mono transition-colors"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Default Model */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">

            {availableModels.length === 0 ? (
              <div className="py-8 text-center text-zinc-600 text-[12px] border border-white/5 rounded-lg bg-white/[0.02]">
                {selectedProvObj.requiresKey && !apiKey
                  ? 'Enter your API Key in the previous step to load models.'
                  : 'Loading models...'}
              </div>
            ) : (
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                <div className="grid grid-cols-2 gap-1.5 pr-1">
                  {availableModels.map((m) => {
                    const isSel = model === m
                    return (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className={`group w-full px-3 py-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                          isSel
                            ? 'bg-white/5 border-white/20 text-white'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-zinc-500'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="text-[11px] font-medium truncate text-zinc-200">{formatModelName(m)}</span>
                          <span className="text-[9px] font-mono text-zinc-600 truncate">{m}</span>
                        </div>
                        {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Advisor Model */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">

            {availableModels.length === 0 ? (
              <div className="py-8 text-center text-zinc-600 text-[12px] border border-white/5 rounded-lg bg-white/[0.02]">
                No models available.
              </div>
            ) : (
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                <div className="grid grid-cols-2 gap-1.5 pr-1">
                  {availableModels.map((m) => {
                    const isSel = advisorModel === m
                    return (
                      <button
                        key={m}
                        onClick={() => setAdvisorModel(m)}
                        className={`group w-full px-3 py-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                          isSel
                            ? 'bg-white/5 border-white/20 text-white'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-zinc-500'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="text-[11px] font-medium truncate text-zinc-200">{formatModelName(m)}</span>
                          <span className="text-[9px] font-mono text-zinc-600 truncate">{m}</span>
                        </div>
                        {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-8 py-4 border-t border-white/5 flex items-center justify-between">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors rounded-md hover:bg-white/5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            onClick={handleContinue}
            className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold rounded-md transition-all active:scale-95 bg-white text-black hover:bg-zinc-100"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-5 py-2 text-[11px] font-semibold rounded-md bg-white text-black hover:bg-zinc-100 transition-all active:scale-95"
          >
            Launch Koda
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        )}
      </footer>

      {/* Koda Cloud Data Privacy Modal Overlay */}
      {showKodaCloudModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-[#09090b] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans select-none">
            {/* Header */}
            <div className="px-6 py-4 bg-white/[0.03] border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-white tracking-tight">Koda Cloud — Data Privacy & Terms</h3>
                  <p className="text-[11px] text-zinc-400 font-medium">Operator proxy & privacy notice</p>
                </div>
              </div>
              <button
                onClick={() => setShowKodaCloudModal(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-lg border border-white/8 bg-white/[0.02] space-y-2">
                <p className="text-[12px] text-zinc-300 leading-relaxed font-medium">
                  When using <strong className="text-white font-semibold">Koda Cloud</strong>, your conversation messages and local agent tool schemas are routed through an operator-hosted proxy.
                </p>
                <div className="text-[11px] text-zinc-400 space-y-1 pt-1">
                  <p className="font-semibold text-zinc-300">Each request sends:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li>Full conversation history (user + assistant messages)</li>
                    <li>All local agent tool names and argument schemas</li>
                  </ul>
                </div>
              </div>

              {/* Proxy URL input */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Proxy Base URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={kodaCloudBaseUrl}
                    onChange={(e) => {
                      setKodaCloudAccepted(false)
                      setKodaCloudBaseUrl(e.target.value)
                    }}
                    placeholder="https://your-proxy.example.com:2137"
                    className="w-full bg-white/[0.03] border border-white/8 text-white rounded-lg px-3 py-2 text-[12px] outline-none focus:border-white/20 font-mono transition-all"
                  />
                  {kodaCloudBaseUrl.startsWith('http://') && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                      ⚠ HTTP — UNENCRYPTED
                    </span>
                  )}
                </div>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-white/8 bg-white/[0.02] cursor-pointer group hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={kodaCloudAccepted}
                  onChange={(e) => setKodaCloudAccepted(e.target.checked)}
                  className="mt-0.5 accent-white w-4 h-4 rounded shrink-0 cursor-pointer"
                />
                <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors leading-relaxed">
                  I understand that my conversation and tool schemas will be sent to the configured proxy endpoint.
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-white/[0.02] border-t border-white/8 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowKodaCloudModal(false)}
                className="px-4 py-2 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!kodaCloudAccepted || !kodaCloudBaseUrl.trim()}
                onClick={() => {
                  setShowKodaCloudModal(false)
                  setStep(3)
                }}
                className={`flex items-center gap-1.5 px-5 py-2 text-[11px] font-semibold rounded-md transition-all ${
                  kodaCloudAccepted && kodaCloudBaseUrl.trim()
                    ? 'bg-white text-black hover:bg-zinc-100 active:scale-95'
                    : 'bg-white/10 text-zinc-500 cursor-not-allowed'
                }`}
              >
                Accept & Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}
