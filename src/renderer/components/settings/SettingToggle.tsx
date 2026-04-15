import React from 'react'

interface SettingToggleProps {
  label: string
  description: string
  enabled: boolean
  onChange: (v: boolean) => void
}

const SettingToggle = ({ label, description, enabled, onChange }: SettingToggleProps) => (
  <div className="flex items-center justify-between group">
    <div className="flex flex-col">
      <span className="text-xs font-bold text-slate-200">{label}</span>
      <span className="text-[10px] text-slate-500">{description}</span>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`w-10 h-5 rounded-full relative transition-all ${enabled ? 'bg-cyan' : 'bg-slate-700'}`}
    >
      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
)

export default SettingToggle
