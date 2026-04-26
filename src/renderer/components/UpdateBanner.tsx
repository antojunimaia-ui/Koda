import React, { memo } from 'react'

interface UpdateBannerProps {
  version?: string
  downloaded: boolean
  onInstall: () => void
  onDismiss: () => void
  variant?: 'modern' | 'classic'
}

const UpdateBanner = memo(({ version, downloaded, onInstall, onDismiss, variant = 'modern' }: UpdateBannerProps) => (
  <div className={`w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl overflow-hidden -mb-4
    ${variant === 'modern' ? 'rounded-2xl rounded-b-none border-b-0' : 'rounded-xl rounded-b-none border-b-0'}
  `}>
    <div className="px-4 pt-2 pb-6 flex items-center gap-3">

      {/* Left: message */}
      <span className="flex-1 text-slate-400 text-[11px] font-medium truncate">
        {downloaded
          ? 'Update ready to install.'
          : `A new update is available.${version ? ` (v${version})` : ''}`
        }
      </span>

      {/* Right: buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onInstall}
          className="px-3 py-1 rounded-lg bg-white text-black text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all active:scale-95"
        >
          {downloaded ? 'Restart & Install' : 'Update'}
        </button>
        <button
          onClick={onDismiss}
          className="w-5 h-5 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-300 hover:bg-neutral-800 transition-all active:scale-95"
          title="Dismiss"
        >
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

    </div>
  </div>
))

UpdateBanner.displayName = 'UpdateBanner'
export default UpdateBanner
