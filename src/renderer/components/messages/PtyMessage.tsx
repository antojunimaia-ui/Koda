import React, { useState, useEffect, useRef, memo } from 'react'
import { MessageEntry, KodaSettings } from '../../types/index.js'
import ansi from '../../utils/ansi.js'

type PtyEntry = MessageEntry['pty']

const PtyMessage = memo(({ pty, settings }: { pty: PtyEntry, settings: KodaSettings }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [pty?.output])

  const handleCtrlC = async () => {
    if (!pty?.pid || sending || pty.exited) return
    setSending(true)
    await window.koda.ptySendCtrlC(pty.pid)
    setTimeout(() => setSending(false), 800)
  }

  const handleKill = async () => {
    if (!pty?.pid || pty.exited) return
    await window.koda.ptyKill(pty.pid)
  }

  return (
    <div className="flex flex-col ml-4 gap-2 my-2 border-l-2 border-slate-600 pl-3 py-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={pty?.exited ? 'text-slate-500' : 'text-[#1e90ff] animate-pulse'}>⚡</span>
        <span className="text-white font-mono text-[13px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          PTY — PID {pty?.pid}
        </span>
        {pty?.exited ? (
          <span className="text-slate-500 text-[11px] font-mono">[exited]</span>
        ) : (
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={handleCtrlC}
              disabled={sending}
              title="Send Ctrl+C (SIGINT)"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 text-yellow-400 hover:bg-slate-700 hover:border-yellow-600 disabled:opacity-40 transition-colors"
            >
              ^C
            </button>
            <button
              onClick={handleKill}
              title="Force kill process"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 border border-slate-600 text-rose-400 hover:bg-slate-700 hover:border-rose-700 transition-colors"
            >
              kill
            </button>
          </div>
        )}
      </div>

      {settings.showPty && (
        <div
          ref={scrollRef}
          className="bg-[#0d1117] border border-slate-700 p-3 rounded-md text-[11px] text-[#58a6ff] font-mono max-h-[150px] overflow-y-auto custom-scrollbar whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: ansi.toHtml(pty?.output || '') }}
        />
      )}
    </div>
  )
})

PtyMessage.displayName = 'PtyMessage'

export default PtyMessage
