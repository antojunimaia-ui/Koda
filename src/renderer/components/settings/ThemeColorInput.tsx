import React from 'react'

interface ThemeColorInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  colorClass?: string
}

const ThemeColorInput = ({ label, value, onChange }: ThemeColorInputProps) => (
  <div className="flex items-center justify-between gap-4">
    <label className="text-slate-400 text-[11px] font-medium">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-20 bg-slate-850 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono focus:border-cyan outline-none"
      />
      <div className="relative w-6 h-6 rounded border border-slate-700 group overflow-hidden">
        <input
          type="color"
          value={value.startsWith('rgba') ? '#22d3ee' : value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="w-full h-full transition-transform group-hover:scale-110" style={{ backgroundColor: value }}></div>
      </div>
    </div>
  </div>
)

export default ThemeColorInput
