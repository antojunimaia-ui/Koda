import React, { memo, useState } from 'react'
import { KodaSettings, MessageEntry } from '../../types/index.js'
import { ChevronRight } from 'lucide-react'
import ansi from '../../utils/ansi.js'

interface CompactPtyViewProps {
  msg: MessageEntry
  settings: KodaSettings
  uiMode: 'classic' | 'modern'
}

/**
 * Bloco PTY colapsável — mesmo padrão do tool-group-collapsible / worked-for
 * do Antigravity: trigger com rótulo (PTY — PID x) + chevron, e o output
 * (mais ^C/kill quando ativo) ao expandir.
 */
const CompactPtyView = memo(({ msg, settings, uiMode }: CompactPtyViewProps) => {
  const [expanded, setExpanded] = useState(false)
  const pty = msg.pty

  if (!pty) return null

  const active = !pty.exited
  const isModern = uiMode === 'modern'

  const sendCtrlC = async () => {
    if (!pty.pid) return
    await window.koda.ptySendCtrlC(pty.pid)
  }
  const kill = async () => {
    if (!pty.pid) return
    await window.koda.ptyKill(pty.pid)
  }

  return (
    <div className={`flex flex-col my-1 ${isModern ? 'font-sans' : 'font-mono'}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`PTY — PID ${pty.pid}`}
        onClick={() => setExpanded((v) => !v)}
        className={`group flex items-center gap-1 w-full text-left px-2 min-h-8 py-1 rounded-lg tabular-nums select-none cursor-pointer transition-colors hover:bg-slate-800/40 ${
          isModern ? 'text-[13px]' : 'text-[12px]'
        }`}
      >
        <span className={`min-w-0 truncate ${active ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
          PTY — PID {pty.pid}
        </span>
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />}
        {pty.exited && <span className="ml-auto text-[10px] text-slate-600 shrink-0">[exited]</span>}
        <ChevronRight
          className={`ml-0.5 h-3.5 w-3.5 shrink-0 transition-all duration-200 ${
            expanded ? 'rotate-90 text-slate-300' : 'text-slate-600 group-hover:text-slate-400'
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-0.5 pl-3 pt-0.5 flex flex-col gap-1.5 animate-in fade-in duration-150">
          {active && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={sendCtrlC}
                title="Send Ctrl+C (SIGINT)"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 text-yellow-400 hover:bg-slate-700 hover:border-yellow-600 transition-colors"
              >
                ^C
              </button>
              <button
                onClick={kill}
                title="Force kill process"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 text-rose-400 hover:bg-slate-700 hover:border-rose-700 transition-colors"
              >
                kill
              </button>
            </div>
          )}
          {settings.showPty && (
            <div className="mui-code p-3 text-[11px] text-[#58a6ff] font-mono max-h-[150px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
              {pty.output?.split('\n').map((line: string, idx: number) => (
                <div key={idx} dangerouslySetInnerHTML={{ __html: ansi.toHtml(line) || '&nbsp;' }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

CompactPtyView.displayName = 'CompactPtyView'

export default CompactPtyView
