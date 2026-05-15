import React, { useState, useEffect, memo } from 'react'
import { KodaTheme, KodaSettings } from '../../types/index.js'
import KodaSettingsTab from './KodaSettingsTab.js'
import RemoteControlTab from './RemoteControlTab.js'
import SkillMarketplace from './SkillMarketplace.js'
import OnboardingTour from '../modern/OnboardingTour.js'
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
}

const SettingsUI = memo(({
  onClose, onSave, defaultProvider, defaultModel, defaultAdvisorModel,
  theme, setTheme, kodaSettings, setKodaSettings, uiMode = 'classic'
}: SettingsUIProps) => {
  const [activeTab, setActiveTab] = useState<'api' | 'themes' | 'koda' | 'remote' | 'skills'>('api')
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('koda_settings_tour_done'))
  const [provider, setProvider] = useState(defaultProvider || 'openai')
  const [model, setModel] = useState(defaultModel || 'gpt-4o')
  const [advisorModel, setAdvisorModel] = useState(defaultAdvisorModel || 'gpt-4o')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('koda_api_key') || '')
  const [models, setModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    if (!apiKey && !['openrouter', 'ollama', 'llamacpp', 'koda-cloud'].includes(provider)) {
      setModels([])
      return
    }
    setIsLoadingModels(true)
    const timer = setTimeout(async () => {
      try {
        console.log(`[Settings] Fetching models for provider: ${provider}`)
        const res = await window.koda.getModels(provider, apiKey)
        console.log(`[Settings] Models response:`, res)
        if (res.success && res.models) {
          setModels(res.models)
          console.log(`[Settings] Loaded ${res.models.length} models`)
        } else {
          console.warn(`[Settings] Failed to load models:`, res.error)
          setModels([])
        }
      } catch (err) {
        console.error(`[Settings] Error fetching models:`, err)
        setModels([])
      } finally {
        setIsLoadingModels(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [provider, apiKey])

  const handleSave = () => {
    localStorage.setItem('koda_api_key', apiKey)
    localStorage.setItem('koda_provider', provider)
    localStorage.setItem('koda_model', model)
    localStorage.setItem('koda_advisor_model', advisorModel)
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
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">            {activeTab === 'api' && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-cyan rounded-full"></span>
                  API Configuration
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Provider</label>
                    <select value={provider} onChange={e => setProvider(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors font-mono text-xs">
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="ollama">Ollama</option>
                      <option value="llamacpp">Llama.cpp</option>
                      <option value="groq">Groq</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="mistral">Mistral AI</option>
                      <option value="together">Together AI</option>
                      <option value="xai">xAI</option>
                      <option value="zhipu">Zhipu AI</option>
                      <option value="maritaca">Maritaca AI</option>
                      <option value="koda-cloud">Koda Cloud</option>
                      <option value="fireworks">Fireworks AI</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Model</label>
                      {isLoadingModels && <span className="text-[10px] text-cyan animate-pulse">Syncing...</span>}
                    </div>
                    {models.length > 0 ? (
                      <select value={model} onChange={e => setModel(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors custom-scrollbar font-mono text-xs">
                        {!models.includes(model) && <option value={model}>{model} (Current)</option>}
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={model} onChange={e => setModel(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors font-mono text-xs" placeholder="ex: llama3" />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Advisor Model</label>
                  {models.length > 0 ? (
                    <select value={advisorModel} onChange={e => setAdvisorModel(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-magenta transition-colors custom-scrollbar font-mono text-xs w-full">
                      {!models.includes(advisorModel) && <option value={advisorModel}>{advisorModel} (Current)</option>}
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={advisorModel} onChange={e => setAdvisorModel(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-magenta transition-colors font-mono text-xs w-full" placeholder="ex: claude-3-sonnet" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">API Key</label>
                    {(provider === 'ollama' || provider === 'llamacpp') && <span className="text-[10px] text-emerald-400 opacity-60">Optional for local</span>}
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    disabled={provider === 'koda-cloud'}
                    onChange={e => setApiKey(e.target.value)}
                    className={`bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-cyan transition-colors font-mono text-xs ${provider === 'koda-cloud' ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                    placeholder={provider === 'koda-cloud' ? 'Cloud Provider handles API keys for you' : (provider === 'ollama' || provider === 'llamacpp' ? 'Not required for local...' : 'Your secret API key...')}
                  />
                  <p className="text-[10px] text-slate-500 italic mt-1">Keys are stored securely in your local storage only.</p>
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
