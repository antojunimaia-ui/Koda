import React, { useState, useEffect, useCallback, memo } from 'react'

const DEFAULT_PORT = 3141

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const RemoteControlTab = memo(() => {
  const [port, setPort] = useState(() => Number(localStorage.getItem('koda_koclaw_port') || DEFAULT_PORT))
  const [token] = useState(() => {
    let t = localStorage.getItem('koda_koclaw_token')
    if (!t) {
      t = generateToken()
      localStorage.setItem('koda_koclaw_token', t)
    }
    return t
  })
  const [status, setStatus] = useState<{ running: boolean; port: number | null }>({ running: false, port: null })
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const refreshStatus = useCallback(async () => {
    const s = await window.koda.koClawStatus()
    setStatus(s as { running: boolean; port: number | null })
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const handleToggle = async () => {
    setError('')
    if (!status.running) {
      const res = await window.koda.koClawStart({ port, token } as any)
      if (!(res as any).success) {
        setError((res as any).error || 'Failed to start')
        return
      }
    } else {
      await window.koda.koClawStop()
    }
    await refreshStatus()
  }

  const copyToken = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const activePort = status.running ? status.port : port

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">

      {/* Header */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-1">
          <span className="w-1.5 h-4 bg-indigo-400 rounded-full" />
          KoClaw — Agent API
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          Exposes a local HTTP API so other agents can send messages to Koda, read the conversation history, and reset the session.
        </p>
      </section>

      {/* Status + toggle */}
      <div className="flex items-center justify-between bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${status.running ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
          <div>
            <span className="text-xs font-bold text-slate-200">
              {status.running ? `Listening on port ${status.port}` : 'Offline'}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {status.running ? 'API is ready to receive requests' : 'Toggle to start the server'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`w-10 h-5 rounded-full relative transition-all ${status.running ? 'bg-indigo-500' : 'bg-slate-700'}`}
        >
          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${status.running ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {error && <p className="text-rose-400 text-[11px]">⚠ {error}</p>}

      {/* Config */}
      <div className="flex flex-col gap-3 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Port</label>
          <input
            type="number"
            value={port}
            disabled={status.running}
            onChange={e => {
              const v = Number(e.target.value)
              setPort(v)
              localStorage.setItem('koda_koclaw_port', String(v))
            }}
            className="w-28 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
          />
          {status.running && <p className="text-[10px] text-slate-500">Stop the server to change the port.</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Bearer Token</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-900 border border-slate-700 text-indigo-300 rounded-lg px-3 py-2 text-xs font-mono truncate select-all">
              {token}
            </code>
            <button
              onClick={copyToken}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-all whitespace-nowrap"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Pass as <code className="bg-slate-900 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> on all requests.
          </p>
        </div>
      </div>

      {/* Endpoints */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
          <span className="w-1.5 h-4 bg-emerald-400 rounded-full" />
          Endpoints
        </h3>
        <div className="flex flex-col gap-1.5">
          {[
            { method: 'GET',  path: '/help',     auth: false, desc: 'API documentation for agents — no auth required' },
            { method: 'POST', path: '/message',  auth: true,  desc: 'Send a task to Koda (returns 202 immediately)' },
            { method: 'GET',  path: '/messages', auth: true,  desc: 'Read full conversation history' },
            { method: 'POST', path: '/reset',    auth: true,  desc: 'Clear conversation and reset the session' },
          ].map(e => (
            <div key={e.path} className="flex items-center gap-3 bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-700/40">
              <span className={`text-[10px] font-black font-mono w-8 ${e.method === 'GET' ? 'text-emerald-400' : 'text-amber-400'}`}>{e.method}</span>
              <code className="text-indigo-300 text-xs font-mono w-24 shrink-0">{e.path}</code>
              <span className="text-slate-500 text-[10px]">{e.desc}</span>
              {!e.auth && <span className="ml-auto text-[9px] text-slate-600 border border-slate-700 rounded px-1.5 py-0.5">public</span>}
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-[10px] mt-2">
          Point agents to <code className="text-slate-500">GET http://localhost:{activePort}/help</code> to let them discover the API on their own.
        </p>
      </section>

    </div>
  )
})

RemoteControlTab.displayName = 'RemoteControlTab'
export default RemoteControlTab