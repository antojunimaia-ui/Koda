import React, { useState, useEffect, memo } from 'react'
import { KodaTheme, KodaSettings } from '../../types/index.js'
import KodaSettingsTab from './KodaSettingsTab.js'
import RemoteControlTab from './RemoteControlTab.js'
import SkillMarketplace from './SkillMarketplace.js'
import OnboardingTour from '../modern/OnboardingTour.js'
import { KoDB } from '../../db/kodb.js'
import tokyoNight from '../../themes/tokyo-night.json'
import monokai from '../../themes/monokai.json'
import cyberpunk from '../../themes/cyberpunk.json'
import githubDark from '../../themes/github-dark.json'

export const THEMES: KodaTheme[] = [
  tokyoNight as KodaTheme,
  monokai as KodaTheme,
  cyberpunk as KodaTheme,
  githubDark as KodaTheme,
]

export const DEFAULT_THEME = THEMES[0]

const PROVIDER_LIST = [
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
  { id: 'ollama', name: 'Ollama (Local)', requiresKey: false, placeholder: 'Optional API key...' },
  { id: 'llamacpp', name: 'Llama.cpp (Local)', requiresKey: false, placeholder: 'Optional API key...' },
  { id: 'koda-cloud', name: 'Koda Cloud', requiresKey: false, placeholder: 'Cloud handles keys' },
]

const PROVIDER_DEFAULTS: Record<string, { model: string, advisorModel: string }> = {
  openai: { model: 'gpt-4o', advisorModel: 'gpt-4o' },
  anthropic: { model: 'claude-3-5-sonnet-20241022', advisorModel: 'claude-3-5-sonnet-20241022' },
  google: { model: 'gemini-1.5-flash', advisorModel: 'gemini-1.5-flash' },
  openrouter: { model: 'google/gemini-2.0-flash-exp:free', advisorModel: 'google/gemini-2.0-flash-exp:free' },
  deepseek: { model: 'deepseek-chat', advisorModel: 'deepseek-chat' },
  groq: { model: 'llama3-8b-8192', advisorModel: 'llama3-8b-8192' },
  ollama: { model: 'llama3', advisorModel: 'llama3' },
  llamacpp: { model: 'local-model', advisorModel: 'local-model' },
  mistral: { model: 'mistral-large-latest', advisorModel: 'mistral-large-latest' },
  together: { model: 'meta-llama/Llama-3-70b-chat-hf', advisorModel: 'meta-llama/Llama-3-70b-chat-hf' },
  xai: { model: 'grok-beta', advisorModel: 'grok-beta' },
  fireworks: { model: 'accounts/fireworks/models/llama-v3-8b-instruct', advisorModel: 'accounts/fireworks/models/llama-v3-8b-instruct' },
  zhipu: { model: 'glm-4-flash', advisorModel: 'glm-4-flash' },
  maritaca: { model: 'sabia-3', advisorModel: 'sabia-3' },
  'koda-cloud': { model: 'gemini-1.5-flash', advisorModel: 'gemini-1.5-flash' },
}

interface SettingsUIProps {
  onClose: () => void
  onSave: (config: { provider: string; model: string; advisorModel: string; apiKey: string }) => void
  defaultProvider: string
  defaultModel: string
  defaultAdvisorModel: string
  theme: KodaTheme
  setTheme: React.Dispatch<React.SetStateAction<KodaTheme>>
  kodaSettings: KodaSettings
  setKodaSettings: React.Dispatch<React.SetStateAction<KodaSettings>>
  uiMode?: 'classic' | 'modern'
  loadedModels: Record<string, string[] | undefined>
  loadingState: Record<string, boolean>
  fetchModelsForProvider: (provId: string, apiKey: string) => Promise<void>
}

const SettingsUI = memo(({
  onClose, onSave, defaultProvider, defaultModel, defaultAdvisorModel,
  theme, setTheme, kodaSettings, setKodaSettings, uiMode = 'classic',
  loadedModels, loadingState, fetchModelsForProvider
}: SettingsUIProps) => {
  const [activeTab, setActiveTab] = useState<'api' | 'themes' | 'koda' | 'remote' | 'skills'>('api')
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('koda_settings_tour_done'))
  const [provider, setProvider] = useState(defaultProvider || 'openai')
  const [model, setModel] = useState(defaultModel || 'gpt-4o')
  const [advisorModel, setAdvisorModel] = useState(defaultAdvisorModel || 'gpt-4o')
  const [apiKey, setApiKey] = useState(() => KoDB.get('apiKey'))

  const [providersConfig, setProvidersConfig] = useState<Record<string, { apiKey: string, model: string, advisorModel: string }>>(() => {
    const parsed = KoDB.get('providersConfig')

    const currentProvider = KoDB.get('provider')
    const currentKey = KoDB.get('apiKey')
    const currentModel = KoDB.get('model')
    const currentAdvisorModel = KoDB.get('advisorModel')

    const initialConfig: Record<string, { apiKey: string, model: string, advisorModel: string }> = {}
    
    PROVIDER_LIST.forEach(p => {
      const isCurrent = p.id === currentProvider
      const savedData = parsed[p.id] || {}
      
      const defaults = PROVIDER_DEFAULTS[p.id] || { model: '', advisorModel: '' }
      
      initialConfig[p.id] = {
        apiKey: savedData.apiKey ?? (isCurrent ? currentKey : ''),
        model: savedData.model ?? (isCurrent && currentModel ? currentModel : defaults.model),
        advisorModel: savedData.advisorModel ?? (isCurrent && currentAdvisorModel ? currentAdvisorModel : (savedData.model ?? defaults.advisorModel))
      }
    })
    
    return initialConfig
  })

  useEffect(() => {
    if (!apiKey && !['openrouter', 'ollama', 'llamacpp', 'koda-cloud'].includes(provider)) {
      return
    }
    fetchModelsForProvider(provider, apiKey)
  }, [provider, apiKey, fetchModelsForProvider])

  const handleFetchModels = (provId: string) => {
    const key = providersConfig[provId]?.apiKey || ''
    const requiresKey = !['openrouter', 'ollama', 'llamacpp', 'koda-cloud'].includes(provId)
    if (requiresKey && !key) {
      return
    }
    fetchModelsForProvider(provId, key)
  }

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const conf = providersConfig[newProvider] || { apiKey: '', model: '', advisorModel: '' }
    setApiKey(conf.apiKey)
    setModel(conf.model)
    setAdvisorModel(conf.advisorModel)
  }

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    updateProviderConfig(provider, { model: newModel })
  }

  const updateProviderConfig = (provId: string, updates: Partial<{ apiKey: string, model: string, advisorModel: string }>) => {
    setProvidersConfig(prev => {
      const updated = {
        ...prev,
        [provId]: {
          ...(prev[provId] || { apiKey: '', model: '', advisorModel: '' }),
          ...updates
        }
      }
      return updated
    })

    if (provId === provider) {
      if (updates.apiKey !== undefined) setApiKey(updates.apiKey)
      if (updates.model !== undefined) setModel(updates.model)
      if (updates.advisorModel !== undefined) setAdvisorModel(updates.advisorModel)
    }
  }

  const handleSave = () => {
    KoDB.set('providersConfig', providersConfig)
    KoDB.set('apiKey', apiKey)
    KoDB.set('provider', provider)
    KoDB.set('model', model)
    KoDB.set('advisorModel', advisorModel)
    onSave({ provider, model, advisorModel, apiKey })
  }


  const TAB_STYLE = (id: string, activeColor: string, activePrefix: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
      activeTab === id
        ? `bg-${activePrefix}/10 text-${activePrefix} border-r-2 border-${activePrefix}`
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`

  return (
    <div className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200 ${uiMode === 'modern' ? 'bg-black/60' : 'bg-black/80'}`}>
      <div className={`flex w-[960px] h-[640px] border rounded-xl overflow-hidden shadow-2xl ${uiMode === 'modern' ? 'bg-[#141414] border-white/8' : 'bg-slate-900 border-slate-700/50'}`}>

        {/* Sidebar */}
        <div className={`w-1/4 flex flex-col p-4 gap-2 ${uiMode === 'modern' ? 'bg-white/[0.02] border-r border-white/5' : 'bg-slate-800/30 border-r border-slate-700/50'}`}>
          <div className={`font-bold flex items-center gap-2 mb-6 px-2 ${uiMode === 'modern' ? 'text-white' : 'text-cyan'}`}>
            <span className="text-xl">⚙️</span> Settings
          </div>

          <button id="stour-api" onClick={() => setActiveTab('api')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'api' ? (uiMode === 'modern' ? 'bg-white/5 text-white border-r-2 border-white/30' : 'bg-cyan/10 text-cyan border-r-2 border-cyan') : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <span>🏢</span> API & Models
          </button>
          <button id="stour-themes" onClick={() => setActiveTab('themes')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'themes' ? (uiMode === 'modern' ? 'bg-white/5 text-white border-r-2 border-white/30' : 'bg-magenta/10 text-magenta border-r-2 border-magenta') : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <span>🎨</span> Themes
          </button>
          <button id="stour-koda" onClick={() => setActiveTab('koda')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'koda' ? (uiMode === 'modern' ? 'bg-white/5 text-white border-r-2 border-white/30' : 'bg-amber-400/10 text-amber-400 border-r-2 border-amber-400') : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <span>🤖</span> Koda Settings
          </button>
          <button id="stour-remote" onClick={() => setActiveTab('remote')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'remote' ? (uiMode === 'modern' ? 'bg-white/5 text-white border-r-2 border-white/30' : 'bg-emerald-400/10 text-emerald-400 border-r-2 border-emerald-400') : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <span>🤖</span> KoClaw
          </button>
          <button id="stour-skills" onClick={() => setActiveTab('skills')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'skills' ? (uiMode === 'modern' ? 'bg-white/5 text-white border-r-2 border-white/30' : 'bg-indigo-400/10 text-indigo-400 border-r-2 border-indigo-400') : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <span>🎯</span> Skills
          </button>

          <div className="mt-auto">
            <button
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-rose-900/10 hover:text-rose-400 transition-all border border-transparent hover:border-rose-900/30"
            >
              <span>✕</span> Close
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'api' && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-cyan rounded-full"></span>
                  API Configuration
                </h3>

                <h4 className="text-white font-bold text-xs mt-2 flex items-center gap-2 border-t border-slate-800 pt-4">
                  <span className="w-1.5 h-3 bg-cyan rounded-full"></span>
                  Saved Provider API Keys, Defaults & Advisor Models
                </h4>

                <div className="flex flex-col gap-1.5 pr-1">
                  {PROVIDER_LIST.map(p => {
                    const isSelected = provider === p.id
                    const pModels = loadedModels[p.id]
                    const isLoading = !!loadingState[p.id]

                    // Class names based on uiMode
                    const isModern = uiMode === 'modern'
                    const containerClass = isModern
                      ? `grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg border transition-all ${isSelected ? 'bg-white/[0.04] border-white/15 shadow-[inset_0_1px_rgba(255,255,255,0.05)]' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`
                      : `grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg border transition-all ${isSelected ? 'bg-cyan/5 border-cyan/20' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`

                    const badgeClass = isModern
                      ? 'text-[9px] font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/10'
                      : 'text-[9px] font-bold text-cyan bg-cyan/10 px-1 py-0.5 rounded border border-cyan/20'

                    const inputClass = isModern
                      ? `w-full bg-neutral-950/40 border border-white/5 text-zinc-300 rounded-md px-2 py-1 outline-none focus:border-white/20 focus:bg-neutral-950/60 transition-all font-mono text-[11px] ${p.id === 'koda-cloud' ? 'opacity-20 cursor-not-allowed' : ''}`
                      : `w-full bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 outline-none focus:border-cyan transition-colors font-mono text-[11px] ${p.id === 'koda-cloud' ? 'opacity-30 cursor-not-allowed' : ''}`

                    const selectClass = isModern
                      ? 'w-full bg-neutral-950/40 border border-white/5 text-zinc-300 rounded-md px-2 py-1 outline-none focus:border-white/20 focus:bg-neutral-950/60 transition-all font-mono text-[11px] custom-scrollbar'
                      : 'w-full bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 outline-none focus:border-magenta transition-colors font-mono text-[11px] custom-scrollbar'

                    const focusBorderClass = isModern ? 'focus:border-white/20' : 'focus:border-magenta'

                    return (
                      <div key={p.id} className={containerClass}>
                        {/* Provider Label & Icon */}
                        <div className="col-span-3 flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-300 truncate" title={p.name}>
                            {p.name}
                          </span>
                          {isSelected && <span className={badgeClass}>Active</span>}
                        </div>
                        
                        {/* API Key Input */}
                        <div className="col-span-5 relative">
                          <input
                            type="password"
                            disabled={p.id === 'koda-cloud'}
                            value={providersConfig[p.id]?.apiKey || ''}
                            onChange={e => updateProviderConfig(p.id, { apiKey: e.target.value })}
                            placeholder={p.placeholder}
                            className={inputClass}
                          />
                        </div>

                        {/* Advisor Model Input */}
                        <div className="col-span-4 relative flex items-center">
                          {pModels && pModels.length > 0 ? (
                            <select
                              value={providersConfig[p.id]?.advisorModel || ''}
                              onChange={e => updateProviderConfig(p.id, { advisorModel: e.target.value })}
                              className={selectClass}
                            >
                              {!pModels.includes(providersConfig[p.id]?.advisorModel || '') && (
                                <option value={providersConfig[p.id]?.advisorModel || ''}>
                                  {providersConfig[p.id]?.advisorModel || 'Select advisor'}
                                </option>
                              )}
                              {pModels.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={providersConfig[p.id]?.advisorModel || ''}
                              onFocus={() => handleFetchModels(p.id)}
                              onChange={e => updateProviderConfig(p.id, { advisorModel: e.target.value })}
                              placeholder={isLoading ? "Loading..." : "Advisor model"}
                              className={`${inputClass} ${focusBorderClass} ${isLoading ? 'animate-pulse' : ''}`}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'themes' && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-magenta rounded-full"></span>
                    Theme Selection
                  </h3>
                  <div className="text-[10px] text-slate-500 font-mono italic">Like VS Code, pick your style</div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Active Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t)}
                        className={`flex flex-col gap-2 p-3 rounded-lg border transition-all text-left group ${theme.id === t.id ? 'border-magenta bg-magenta/10 shadow-[0_0_15px_rgba(217,70,239,0.1)]' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/70'}`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className={`text-xs font-bold ${theme.id === t.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{t.name}</span>
                          {theme.id === t.id && <span className="text-magenta text-[10px]">●</span>}
                        </div>
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.bg }}></div>
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.accent }}></div>
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.colors.accentAlt }}></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl border border-slate-700/50" style={{ backgroundColor: theme.colors.bgAlt }}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Live Preview</div>
                  <div className="flex flex-col gap-3 p-2">
                    <div className="flex gap-2 items-center">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.accent }}></div>
                      <div className="text-xs font-bold" style={{ color: theme.colors.text }}>This is how Koda will look.</div>
                    </div>
                    <div className="p-3 rounded-lg border text-[10px] leading-relaxed" style={{ backgroundColor: theme.colors.sidebar, borderColor: theme.colors.border, color: theme.colors.textDim }}>
                      The quick brown fox jumps over the lazy dog.
                      <code className="ml-2 font-mono" style={{ color: theme.colors.accentAlt }}>npm run dev</code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'koda' && <KodaSettingsTab kodaSettings={kodaSettings} setKodaSettings={setKodaSettings} uiMode={kodaSettings.uiMode ?? 'classic'} />}
            {activeTab === 'remote' && <RemoteControlTab />}
            {activeTab === 'skills' && <SkillMarketplace />}
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 flex justify-between items-center border-t ${uiMode === 'modern' ? 'bg-white/[0.02] border-white/5' : 'bg-slate-800/10 border-slate-700/50'}`}>
            <div className="text-[10px] text-slate-500 font-mono">
              v26.1.5 — Build 2026.05.01
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-lg font-bold border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors text-xs">
                Cancel
              </button>
              <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold bg-cyan/80 text-white hover:bg-cyan transition-all transform active:scale-95 shadow-lg shadow-cyan/10 text-xs">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      <OnboardingTour mode="settings" active={showTour} onDone={() => setShowTour(false)} />
    </div>
  )
})

SettingsUI.displayName = 'SettingsUI'

export default SettingsUI
