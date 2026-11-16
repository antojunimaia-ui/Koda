import React, { useState, useEffect, memo } from 'react'
import { ArrowLeft, Bot, KeyRound, Palette, Radio, Settings, Target } from 'lucide-react'
import { KodaTheme, KodaSettings } from '../../types/index.js'
import KodaSettingsTab from './KodaSettingsTab.js'
import RemoteControlTab from './RemoteControlTab.js'
import SkillMarketplace from './SkillMarketplace.js'
import OnboardingTour from '../modern/OnboardingTour.js'
import { KoDB } from '../../db/kodb.js'
import {
  DEFAULT_MODELS,
  getProvider,
  NO_KEY_PROVIDERS,
  PROVIDERS as PROVIDER_LIST,
} from '../../../shared/configDefaults.js'
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

const PROVIDER_DEFAULTS: Record<string, { model: string; advisorModel: string }> = Object.fromEntries(
  PROVIDER_LIST.map((p) => [p.id, { model: DEFAULT_MODELS[p.id], advisorModel: DEFAULT_MODELS[p.id] }]),
)

interface SettingsUIProps {
  onClose: () => void
  onSave: (config: {
    provider: string
    model: string
    advisorModel: string
    apiKey: string
    kodaCloudBaseUrl?: string
  }) => void
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

const SettingsUI = memo(
  ({
    onClose,
    onSave,
    defaultProvider,
    defaultModel,
    defaultAdvisorModel,
    theme,
    setTheme,
    kodaSettings,
    setKodaSettings,
    uiMode = 'classic',
    loadedModels,
    loadingState,
    fetchModelsForProvider,
  }: SettingsUIProps) => {
    const [activeTab, setActiveTab] = useState<'api' | 'themes' | 'koda' | 'remote' | 'skills'>('api')
    const [showTour, setShowTour] = useState(() => !localStorage.getItem('koda_settings_tour_done'))

    // Settings is a full screen now — Esc returns to the agent view
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])
    const [provider, setProvider] = useState(defaultProvider || 'openai')
    const [model, setModel] = useState(defaultModel || 'gpt-4o')
    const [advisorModel, setAdvisorModel] = useState(defaultAdvisorModel || 'gpt-4o')
    const [apiKey, setApiKey] = useState(() => KoDB.get('apiKey'))
    const [kodaCloudBaseUrl, setKodaCloudBaseUrl] = useState(() => KoDB.get('kodaCloudBaseUrl') || '')

    const [providersConfig, setProvidersConfig] = useState<
      Record<string, { apiKey: string; model: string; advisorModel: string }>
    >(() => {
      const parsed = KoDB.get('providersConfig')

      const currentProvider = KoDB.get('provider')
      const currentKey = KoDB.get('apiKey')
      const currentModel = KoDB.get('model')
      const currentAdvisorModel = KoDB.get('advisorModel')

      const initialConfig: Record<string, { apiKey: string; model: string; advisorModel: string }> = {}

      PROVIDER_LIST.forEach((p) => {
        const isCurrent = p.id === currentProvider
        const savedData = parsed[p.id] || {}

        const defaults = PROVIDER_DEFAULTS[p.id] || { model: '', advisorModel: '' }

        initialConfig[p.id] = {
          apiKey: savedData.apiKey ?? (isCurrent ? currentKey : ''),
          model: savedData.model ?? (isCurrent && currentModel ? currentModel : defaults.model),
          advisorModel:
            savedData.advisorModel ??
            (isCurrent && currentAdvisorModel ? currentAdvisorModel : (savedData.model ?? defaults.advisorModel)),
        }
      })

      return initialConfig
    })

    useEffect(() => {
      // Skip if models already loaded for this provider
      if (loadedModels[provider]) return
      const keyToUse = getProvider(provider)?.credential === 'baseUrl' ? kodaCloudBaseUrl : apiKey
      if (!keyToUse && !NO_KEY_PROVIDERS.includes(provider as (typeof NO_KEY_PROVIDERS)[number])) {
        return
      }
      fetchModelsForProvider(provider, keyToUse)
    }, [provider, apiKey, kodaCloudBaseUrl, fetchModelsForProvider, loadedModels])

    const handleFetchModels = (provId: string) => {
      const key =
        getProvider(provId)?.credential === 'baseUrl' ? kodaCloudBaseUrl : providersConfig[provId]?.apiKey || ''
      const requiresKey = !NO_KEY_PROVIDERS.includes(provId as (typeof NO_KEY_PROVIDERS)[number])
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

    const updateProviderConfig = (
      provId: string,
      updates: Partial<{ apiKey: string; model: string; advisorModel: string }>,
    ) => {
      setProvidersConfig((prev) => {
        const updated = {
          ...prev,
          [provId]: {
            ...(prev[provId] || { apiKey: '', model: '', advisorModel: '' }),
            ...updates,
          },
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
      KoDB.set('kodaCloudBaseUrl', kodaCloudBaseUrl)
      onSave({ provider, model, advisorModel, apiKey, kodaCloudBaseUrl })
    }

    const isModern = uiMode === 'modern'

    const tabClass = (id: typeof activeTab) =>
      `group flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
        activeTab === id
          ? isModern
            ? 'mui-nav-item--active'
            : 'bg-cyan/10 text-cyan'
          : isModern
            ? 'mui-nav-item'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`

    const tabs: Array<{ id: typeof activeTab; icon: React.ReactNode; label: string; hint: string }> = [
      {
        id: 'api',
        icon: <KeyRound className="h-4 w-4 shrink-0" />,
        label: 'API & Models',
        hint: 'Providers, keys, models',
      },
      { id: 'themes', icon: <Palette className="h-4 w-4 shrink-0" />, label: 'Themes', hint: 'Colors and appearance' },
      {
        id: 'koda',
        icon: <Bot className="h-4 w-4 shrink-0" />,
        label: 'Koda Settings',
        hint: 'Tools, UI and behavior',
      },
      { id: 'remote', icon: <Radio className="h-4 w-4 shrink-0" />, label: 'KoClaw', hint: 'Remote control' },
      { id: 'skills', icon: <Target className="h-4 w-4 shrink-0" />, label: 'Skills', hint: 'Installed skills' },
    ]

    return (
      <div
        className={`absolute inset-0 z-modal animate-in fade-in duration-150 ${isModern ? 'mui-app' : 'flex flex-col bg-slate-950 text-white'}`}
      >
        {/* Top bar — a tela substitui o agente, então tem saída explícita */}
        <header
          className={`h-14 shrink-0 flex items-center gap-3 px-4 ${isModern ? 'mui-hairline-b' : 'border-b border-slate-800 bg-slate-900/40'}`}
        >
          <button
            onClick={onClose}
            title="Back to agent (Esc)"
            className={
              isModern
                ? 'mui-btn mui-btn--ghost'
                : 'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors text-slate-400 hover:text-white hover:bg-slate-800'
            }
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className={`h-4 w-px ${isModern ? 'bg-white/10' : 'bg-slate-700'}`} />
          <span className="text-sm font-bold flex items-center gap-2">
            <Settings className="h-4 w-4 opacity-60" />
            Settings
          </span>
          <span className="ml-2 text-[10px] font-mono text-slate-600">v26.1.5</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleSave}
              className={
                isModern
                  ? 'mui-btn mui-btn--primary'
                  : 'px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 bg-cyan/80 text-white hover:bg-cyan'
              }
            >
              Save Changes
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          {/* Sidebar */}
          <aside
            className={`w-60 shrink-0 flex flex-col gap-1 p-3 ${isModern ? 'mui-hairline-r' : 'bg-slate-900/30 border-r border-slate-800'}`}
          >
            <div
              className={`px-3 pt-2 pb-3 ${isModern ? 'mui-eyebrow' : 'text-[10px] font-bold uppercase tracking-widest text-slate-600'}`}
            >
              Preferences
            </div>

            {tabs.map((t) => (
              <button key={t.id} id={`stour-${t.id}`} onClick={() => setActiveTab(t.id)} className={tabClass(t.id)}>
                <span className={activeTab === t.id ? '' : 'opacity-60'}>{t.icon}</span>
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{t.label}</span>
                  <span className="text-[10px] font-normal text-slate-600 truncate">{t.hint}</span>
                </span>
              </button>
            ))}

            <div className="mt-auto px-3 py-2 text-[10px] text-slate-600 leading-relaxed">
              Changes are saved when you press <span className="font-mono text-slate-500">Save Changes</span>.
            </div>
          </aside>

          {/* Content Area */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-4xl mx-auto p-8">
                {activeTab === 'api' && (
                  <div className="flex flex-col gap-6">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-cyan rounded-full"></span>
                      API Configuration
                    </h3>

                    <h4 className="text-white font-bold text-xs mt-2 flex items-center gap-2 border-t border-slate-800 pt-4">
                      <span className="w-1.5 h-3 bg-cyan rounded-full"></span>
                      Saved Provider API Keys, Defaults & Advisor Models
                    </h4>

                    <div className="flex flex-col gap-1.5 pr-1">
                      {PROVIDER_LIST.map((p) => {
                        const isSelected = provider === p.id
                        const pModels = loadedModels[p.id]
                        const isLoading = !!loadingState[p.id]

                        // Class names based on uiMode
                        const isModern = uiMode === 'modern'
                        const containerClass = isModern
                          ? `grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg border transition-all ${isSelected ? 'mui-option-card--selected shadow-[inset_0_1px_rgba(255,255,255,0.05)]' : 'mui-option-card'}`
                          : `grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg border transition-all ${isSelected ? 'bg-cyan/5 border-cyan/20' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`

                        const badgeClass = isModern
                          ? 'mui-chip bg-white/10 text-white'
                          : 'text-[9px] font-bold text-cyan bg-cyan/10 px-1 py-0.5 rounded border border-cyan/20'

                        const inputClass = isModern
                          ? `mui-field mui-field--mono ${p.credential === 'baseUrl' ? 'opacity-20 cursor-not-allowed' : ''}`
                          : `w-full bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 outline-none focus:border-cyan transition-colors font-mono text-[11px] ${p.credential === 'baseUrl' ? 'opacity-30 cursor-not-allowed' : ''}`

                        const selectClass = isModern
                          ? 'mui-select custom-scrollbar'
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

                            {/* API Key / Base URL Input */}
                            <div className="col-span-5 relative">
                              {p.credential === 'baseUrl' ? (
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={kodaCloudBaseUrl}
                                    onChange={(e) => setKodaCloudBaseUrl(e.target.value)}
                                    placeholder="http://your-proxy:2137"
                                    className={
                                      uiMode === 'modern'
                                        ? 'mui-field mui-field--mono focus:border-amber-500/30'
                                        : 'w-full bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 outline-none focus:border-amber-500/30 transition-all font-mono text-[11px]'
                                    }
                                  />
                                  {kodaCloudBaseUrl.startsWith('http://') && (
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-amber-400 uppercase tracking-wide whitespace-nowrap">
                                      ⚠ HTTP
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="password"
                                  value={providersConfig[p.id]?.apiKey || ''}
                                  onChange={(e) => updateProviderConfig(p.id, { apiKey: e.target.value })}
                                  placeholder={p.placeholder}
                                  className={inputClass}
                                />
                              )}
                            </div>

                            {/* Advisor Model Input */}
                            <div className="col-span-4 relative flex items-center">
                              {pModels && pModels.length > 0 ? (
                                <select
                                  value={providersConfig[p.id]?.advisorModel || ''}
                                  onChange={(e) => updateProviderConfig(p.id, { advisorModel: e.target.value })}
                                  className={selectClass}
                                >
                                  {!pModels.includes(providersConfig[p.id]?.advisorModel || '') && (
                                    <option value={providersConfig[p.id]?.advisorModel || ''}>
                                      {providersConfig[p.id]?.advisorModel || 'Select advisor'}
                                    </option>
                                  )}
                                  {pModels.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={providersConfig[p.id]?.advisorModel || ''}
                                  onFocus={() => handleFetchModels(p.id)}
                                  onChange={(e) => updateProviderConfig(p.id, { advisorModel: e.target.value })}
                                  placeholder={isLoading ? 'Loading...' : 'Advisor model'}
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
                  <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-magenta rounded-full"></span>
                        Theme Selection
                      </h3>
                      <div className="text-[10px] text-slate-500 font-mono italic">Like VS Code, pick your style</div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                        Active Theme
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setTheme(t)}
                            className={`flex flex-col gap-2 p-3 rounded-lg border transition-all text-left group ${theme.id === t.id ? 'border-magenta bg-magenta/10 shadow-[0_0_15px_rgba(217,70,239,0.1)]' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/70'}`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span
                                className={`text-xs font-bold ${theme.id === t.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}
                              >
                                {t.name}
                              </span>
                              {theme.id === t.id && <span className="text-magenta text-[10px]">●</span>}
                            </div>
                            <div className="flex gap-1">
                              <div
                                className="w-4 h-4 rounded-full border border-white/10"
                                style={{ backgroundColor: t.colors.bg }}
                              ></div>
                              <div
                                className="w-4 h-4 rounded-full border border-white/10"
                                style={{ backgroundColor: t.colors.accent }}
                              ></div>
                              <div
                                className="w-4 h-4 rounded-full border border-white/10"
                                style={{ backgroundColor: t.colors.accentAlt }}
                              ></div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      className="mt-4 p-4 rounded-xl border border-slate-700/50"
                      style={{ backgroundColor: theme.colors.bgAlt }}
                    >
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">
                        Live Preview
                      </div>
                      <div className="flex flex-col gap-3 p-2">
                        <div className="flex gap-2 items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.accent }}></div>
                          <div className="text-xs font-bold" style={{ color: theme.colors.text }}>
                            This is how Koda will look.
                          </div>
                        </div>
                        <div
                          className="p-3 rounded-lg border text-[10px] leading-relaxed"
                          style={{
                            backgroundColor: theme.colors.sidebar,
                            borderColor: theme.colors.border,
                            color: theme.colors.textDim,
                          }}
                        >
                          The quick brown fox jumps over the lazy dog.
                          <code className="ml-2 font-mono" style={{ color: theme.colors.accentAlt }}>
                            npm run dev
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'koda' && (
                  <KodaSettingsTab
                    kodaSettings={kodaSettings}
                    setKodaSettings={setKodaSettings}
                    uiMode={kodaSettings.uiMode ?? 'classic'}
                  />
                )}
                {activeTab === 'remote' && <RemoteControlTab />}
                {activeTab === 'skills' && <SkillMarketplace />}
              </div>
            </div>

            {/* Footer */}
            <div
              className={`shrink-0 px-8 py-2.5 flex justify-between items-center ${isModern ? 'mui-hairline-t' : 'border-t bg-slate-900/30 border-slate-800'}`}
            >
              <div className="text-[10px] text-slate-600 font-mono">v26.1.5 — Build 2026.05.01</div>
              <div className="text-[10px] text-slate-600 flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/50 font-mono text-[9px] text-slate-400">
                  Esc
                </kbd>
                to go back to the agent
              </div>
            </div>
          </div>
        </div>

        <OnboardingTour mode="settings" active={showTour} onDone={() => setShowTour(false)} />
      </div>
    )
  },
)

SettingsUI.displayName = 'SettingsUI'

export default SettingsUI
