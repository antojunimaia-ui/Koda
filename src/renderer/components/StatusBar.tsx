import React from 'react'

interface StatusBarProps {
  onSettingsClick?: () => void
  onToggleSplit?: () => void
  isSplitEnabled?: boolean
}

const StatusBar: React.FC<StatusBarProps> = ({ onSettingsClick, onToggleSplit, isSplitEnabled }) => {
  return (
    <div className="h-6 bg-[#0a0a0a] border-t border-white/5 flex items-center px-2 shrink-0 select-none">
      {/* Left section */}
      <div className="flex items-center gap-0.5">
        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
          title="Settings"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        {/* Workspace Split */}
        <button
          onClick={onToggleSplit}
          className={`w-5 h-5 flex items-center justify-center rounded transition-all ${isSplitEnabled ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'}`}
          title={isSplitEnabled ? 'Disable Workspace Split' : 'Enable Workspace Split'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/>
          </svg>
        </button>
      </div>

      {/* Center */}
      <div className="flex-1" />

      {/* Right */}
      <div className="flex items-center gap-2 text-slate-600 text-[10px]" />
    </div>
  )
}

export default StatusBar
