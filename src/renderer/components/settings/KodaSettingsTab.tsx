import React, { useState, useEffect, memo } from 'react'
import { KodaSettings } from '../../types/index.js'
import SettingToggle from './SettingToggle.js'

interface KodaSettingsTabProps {
  kodaSettings: KodaSettings
  setKodaSettings: React.Dispatch<React.SetStateAction<KodaSettings>>
  uiMode: 'classic' | 'modern'
}

const KodaSettingsTab = memo(({ kodaSettings, setKodaSettings, uiMode }: KodaSettingsTabProps) => {
  const [approved, setApproved] = useState<{ base: string[]; full: string[] }>({ base: [], full: [] })
  const [newCmd, setNewCmd] = useState('')
  const [type, setType] = useState<'base' | 'full'>('base')

  useEffect(() => {
    window.koda.getApprovedCommands().then(setApproved)
  }, [])

  const addCmd = async () => {
    if (!newCmd.trim()) return
    const updated = { ...approved, [type]: [...new Set([...approved[type], newCmd.trim()])] }
    setApproved(updated)
    await window.koda.updateApprovedCommands(updated)
    localStorage.setItem('koda_approved_base', JSON.stringify(updated.base))
    localStorage.setItem('koda_approved_full', JSON.stringify(updated.full))
    setNewCmd('')
  }

  const removeCmd = async (cmd: string, t: 'base' | 'full') => {
    const updated = { ...approved, [t]: approved[t].filter(c => c !== cmd) }
    setApproved(updated)
    await window.koda.updateApprovedCommands(updated)
    localStorage.setItem('koda_approved_base', JSON.stringify(updated.base))
    localStorage.setItem('koda_approved_full', JSON.stringify(updated.full))
  }

  return (
    <div className="flex flex-col gap-8 animate-in slide-in-from-left-2 duration-300">
      {/* Workspace Layout Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-cyan-400 rounded-full"></span>
          Workspace Layout
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Customize where your tools appear. If both are on the same side, they will stack vertically.</p>
        
        <div className="flex flex-col gap-5 bg-slate-800/20 p-5 rounded-xl border border-slate-700/50">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em]">Browser Engine</label>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                <button 
                  onClick={() => setKodaSettings(prev => ({ ...prev, browserPosition: 'left' }))}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${kodaSettings.browserPosition === 'left' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >Left Side</button>
                <button 
                  onClick={() => setKodaSettings(prev => ({ ...prev, browserPosition: 'right' }))}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${kodaSettings.browserPosition === 'right' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >Right Side</button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em]">Terminal Panel</label>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                <button 
                  onClick={() => setKodaSettings(prev => ({ ...prev, terminalPosition: 'left' }))}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${kodaSettings.terminalPosition === 'left' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >Left Side</button>
                <button 
                  onClick={() => setKodaSettings(prev => ({ ...prev, terminalPosition: 'right' }))}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${kodaSettings.terminalPosition === 'right' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >Right Side</button>
              </div>
            </div>
          </div>

          {uiMode === 'modern' && (
            <div className="pt-2 border-t border-slate-800/50">
              <SettingToggle 
                label="Icon Bar" 
                description="Show a vertical navigation toolbar on the left side" 
                enabled={kodaSettings.showIconBar} 
                onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showIconBar: v }))} 
              />
            </div>
          )}
        </div>
      </section>

      {/* UI Mode Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
          Interface Style
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Choose between the classic Terminal interface or a modern, streamlined UI.</p>
        
        <div className="flex gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
          <button 
            onClick={() => setKodaSettings(prev => ({ ...prev, uiMode: 'classic' }))}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-lg border transition-all ${kodaSettings.uiMode === 'classic' || !kodaSettings.uiMode ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
          >
            <span className="text-2xl">📟</span>
            <div className="text-center">
              <div className="font-bold text-xs text-white">Classic CLI</div>
              <div className="text-[9px] opacity-60">Retro Terminal Vibes</div>
            </div>
          </button>
          
          <button 
            onClick={() => setKodaSettings(prev => ({ ...prev, uiMode: 'modern' }))}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-lg border transition-all ${kodaSettings.uiMode === 'modern' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
          >
            <span className="text-2xl">✨</span>
            <div className="text-center">
              <div className="font-bold text-xs text-white">Modern Pro</div>
              <div className="text-[9px] opacity-60">Clean & Productive</div>
            </div>
          </button>
        </div>
      </section>

      {/* Tool View Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-emerald-400 rounded-full"></span>
          Tool View Mode
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Choose how agent actions are displayed. Compact mode groups consecutive tool calls into a summary.</p>
        
        <div className="flex bg-slate-800/20 p-1.5 rounded-xl border border-slate-700/50">
          <button 
            onClick={() => setKodaSettings(prev => ({ ...prev, toolViewMode: 'standard' }))}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${kodaSettings.toolViewMode === 'standard' || !kodaSettings.toolViewMode ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span>Standard</span>
            <span className="text-[9px] opacity-60 font-medium">Individual Blocks</span>
          </button>
          <button 
            onClick={() => setKodaSettings(prev => ({ ...prev, toolViewMode: 'compact' }))}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${kodaSettings.toolViewMode === 'compact' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span>Compact</span>
            <span className="text-[9px] opacity-60 font-medium">Grouped Summaries</span>
          </button>
        </div>
      </section>

      {/* Verbosity Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-amber-400 rounded-full"></span>
          Output Verbosity
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Toggle tool output visibility in chat. Does not affect agent context.</p>

        <div className="flex flex-col gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
          <SettingToggle label="Show Terminal Output" description="Live output from running terminal processes (npm, etc)" enabled={kodaSettings.showTerminal} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showTerminal: v }))} />
          <SettingToggle label="Show Terminal Stream" description="Enable or disable the display of PTY (Terminal) shell messages in chat" enabled={kodaSettings.showPty} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showPty: v }))} />
          <SettingToggle label="Show Shell Wait Output" description="Output from synchronous shell commands (ls, mkdir, etc)" enabled={kodaSettings.showShellWait} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showShellWait: v }))} />
          <SettingToggle label="Show File Read Output" description="The content of files read by the agent" enabled={kodaSettings.showFileRead} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showFileRead: v }))} />
          <SettingToggle label="Show File Edit Output" description="Diffs and changes made to files" enabled={kodaSettings.showFileEdit} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showFileEdit: v }))} />
          <SettingToggle label="Show List Dir Output" description="Directory listings and file structures" enabled={kodaSettings.showListDir} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showListDir: v }))} />
          <SettingToggle label="Show File Find Output" description="Search results and file matching logs" enabled={kodaSettings.showFileFind} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showFileFind: v }))} />
          <SettingToggle label="Show File Write Output" description="Details of files created or overwritten" enabled={kodaSettings.showFileWrite} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showFileWrite: v }))} />
          <SettingToggle label="Show Search Output" description="Results from regex searches across files" enabled={kodaSettings.showSearch} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showSearch: v }))} />
          <SettingToggle label="Show LSP Query Output" description="Results from semantic code analysis (Hover/Definition)" enabled={kodaSettings.showLspQuery} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showLspQuery: v }))} />
          <SettingToggle label="Show Browser Agent Output" description="Reports from web navigation sub-agents" enabled={kodaSettings.showBrowserAgent} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showBrowserAgent: v }))} />
          <SettingToggle label="Show Plan Mode Output" description="Transitions and strategies developed in Plan Mode" enabled={kodaSettings.showPlanMode} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showPlanMode: v }))} />
          <SettingToggle label="Show Collaboration Output" description="Messages exchanged with advisor LLMs" enabled={kodaSettings.showColab} onChange={(v: boolean) => setKodaSettings(prev => ({ ...prev, showColab: v }))} />
        </div>
      </section>

      {/* Approved Commands Section */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
          Approved Commands
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">Commands in this list will execute automatically without asking for permission.</p>

        <div className="flex flex-col gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
          <div className="flex gap-2">
            <select
              value={type}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={e => setType(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="base">Base Command</option>
              <option value="full">Full String</option>
            </select>
            <input
              type="text"
              value={newCmd}
              onChange={e => setNewCmd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCmd()}
              placeholder={type === 'base' ? 'ex: npm' : 'ex: npm install'}
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 text-xs outline-none focus:border-emerald-500 transition-colors"
            />
            <button onClick={addCmd} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95">Add</button>
          </div>

          <div className="flex flex-col gap-6 pt-2">
            <div>
              <label className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em] mb-3 block">Base Commands (Session)</label>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {approved.base.length === 0 && <span className="text-slate-600 text-[10px] italic">No base commands approved yet.</span>}
                {approved.base.map(cmd => (
                  <span key={cmd} className="group flex items-center gap-2 px-2.5 py-1 bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono shadow-sm">
                    {cmd}
                    <button onClick={() => removeCmd(cmd, 'base')} className="hover:text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]">✕</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <label className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em] mb-3 block">Full Command Strings (Session)</label>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {approved.full.length === 0 && <span className="text-slate-600 text-[10px] italic">No full strings approved yet.</span>}
                {approved.full.map(cmd => (
                  <span key={cmd} className="group flex items-center gap-2 px-2.5 py-1 bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-[10px] font-mono shadow-sm max-w-full">
                    <span className="truncate">{cmd}</span>
                    <button onClick={() => removeCmd(cmd, 'full')} className="hover:text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] flex-shrink-0">✕</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
})

KodaSettingsTab.displayName = 'KodaSettingsTab'

export default KodaSettingsTab
