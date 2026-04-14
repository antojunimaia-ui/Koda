import React, { useEffect, useRef, memo } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalPanelProps {
  onClose: () => void
  cwd?: string
}

const TerminalPanel: React.FC<TerminalPanelProps> = memo(({ onClose, cwd }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const pidRef = useRef<number | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#334D5C',
      },
      fontSize: 12,
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      letterSpacing: 0,
      lineHeight: 1.2,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Init PTY
    window.koda.ptyStart(cwd).then(res => {
      if (res.success) {
        pidRef.current = res.pid
        
        // Handle input
        term.onData(data => {
          if (pidRef.current) {
            window.koda.ptyWrite(pidRef.current, data)
          }
        })

        // Initial resize
        const { cols, rows } = term
        window.koda.ptyResize(res.pid, cols, rows)
      }
    })

    const handleResize = () => {
      fitAddon.fit()
      if (pidRef.current && term) {
        window.koda.ptyResize(pidRef.current, term.cols, term.rows)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
        handleResize();
    });
    resizeObserver.observe(terminalRef.current);

    // Global listener for terminal output
    const updateHandler = (update: any) => {
      if (update.type === 'terminal:output' && update.pid === pidRef.current) {
        term.write(update.data)
      } else if (update.type === 'terminal:exit' && update.pid === pidRef.current) {
        term.write('\r\n[Process exited]\r\n')
      }
    }

    const unsubscribe = window.koda.onUpdate(updateHandler)

    return () => {
      if (pidRef.current) {
        window.koda.ptyKill(pidRef.current)
      }
      term.dispose()
      resizeObserver.disconnect()
      unsubscribe()
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-r border-slate-700/50 animate-in slide-in-from-left duration-300">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/40 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-cyan text-xs">⌨️</span>
          <span className="text-white font-black text-[10px] uppercase tracking-widest">Interactive Terminal</span>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden p-2" />
    </div>
  )
})

export default TerminalPanel
