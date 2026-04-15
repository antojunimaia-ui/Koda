import React, { useState, useEffect, memo } from 'react'

const RemoteControlTab = memo(() => {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('koda_webhook_enabled') === 'true')
  const [port, setPort] = useState(() => parseInt(localStorage.getItem('koda_webhook_port') || '3141', 10))
  const [token, setToken] = useState(() => localStorage.getItem('koda_webhook_token') || '')
  const [status, setStatus] = useState<{ running: boolean; port: number | null }>({ running: false, port: null })
  const [error, setError] = useState('')
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    window.koda.webhookStatus().then(setStatus)
  }, [])

  const generateToken = () => {
    const t = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    setToken(t)
  }

  const handleToggle = async (val: boolean) => {
    setEnabled(val)
    setError('')
    localStorage.setItem('koda_webhook_enabled', String(val))
    if (val) {
      if (!token) { setError('Generate a token first.'); setEnabled(false); return }
      const res = await window.koda.webhookStart({ port, token })
      if (!res.success) { setError(res.error || 'Failed to start'); setEnabled(false); return }
    } else {
      await window.koda.webhookStop()
    }
    const s = await window.koda.webhookStatus()
    setStatus(s)
  }

  const handleSavePort = async () => {
    localStorage.setItem('koda_webhook_port', String(port))
    localStorage.setItem('koda_webhook_token', token)
    if (enabled) {
      await window.koda.webhookStop()
      const res = await window.koda.webhookStart({ port, token })
      if (!res.success) setError(res.error || 'Failed to restart')
      const s = await window.koda.webhookStatus()
      setStatus(s)
    }
  }

  const ENDPOINTS = [
    { method: 'GET',  path: '/status',   desc: 'Agent status (public)',    color: 'text-cyan-400' },
    { method: 'POST', path: '/task',      desc: '{ message } → send task', color: 'text-emerald-400' },
    { method: 'POST', path: '/reset',     desc: 'Reset conversation',      color: 'text-amber-400' },
    { method: 'GET',  path: '/messages',  desc: 'Get conversation history', color: 'text-cyan-400' },
  ]

  return (
    <div className="flex flex-col gap-8 animate-in slide-in-from-left-2 duration-300">
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-1">
          <span className="w-1.5 h-4 bg-emerald-400 rounded-full"></span>
          Remote Control
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed mb-4">
          Expose a local HTTP API so external tools (GitHub Actions, bots, scripts) can send tasks to Koda via Tailscale or localhost.
        </p>

        {/* Status + toggle */}
        <div className="flex items-center justify-between bg-slate-800/20 p-4 rounded-xl border border-slate-700/50 mb-4">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${status.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <div>
              <span className="text-xs font-bold text-slate-200">{status.running ? `Online — port ${status.port}` : 'Offline'}</span>
              <p className="text-[10px] text-slate-500 mt-0.5">HTTP server on 0.0.0.0 (all interfaces)</p>
            </div>
          </div>
          <button
            onClick={() => handleToggle(!enabled)}
            className={`w-10 h-5 rounded-full relative transition-all ${enabled && status.running ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${enabled && status.running ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {error && <p className="text-rose-400 text-[11px] mb-3">⚠ {error}</p>}

        <div className="flex flex-col gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Port</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={port}
                onChange={e => setPort(parseInt(e.target.value) || 3141)}
                className="w-28 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500 transition-colors"
              />
              <button onClick={handleSavePort} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">Apply</button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Auth Token</label>
            <div className="flex gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => { setToken(e.target.value); localStorage.setItem('koda_webhook_token', e.target.value) }}
                placeholder="Generate or paste a token..."
                className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500 transition-colors"
              />
              <button onClick={() => setShowToken(p => !p)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-all">{showToken ? '🙈' : '👁'}</button>
              <button onClick={generateToken} className="px-3 py-2 bg-emerald-700/50 hover:bg-emerald-600/60 text-emerald-300 rounded-lg text-xs font-bold transition-all">Generate</button>
            </div>
            <p className="text-[10px] text-slate-500">Send as <code className="bg-slate-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> header.</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
          <span className="w-1.5 h-4 bg-slate-500 rounded-full"></span>
          Endpoints
        </h3>
        <div className="flex flex-col gap-2 font-mono text-[11px]">
          {ENDPOINTS.map(e => (
            <div key={e.path} className="flex items-center gap-3 bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-700/40">
              <span className={`font-black w-10 flex-shrink-0 ${e.color}`}>{e.method}</span>
              <code className="text-slate-300 flex-shrink-0">{e.path}</code>
              <span className="text-slate-500 text-[10px]">{e.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
})

RemoteControlTab.displayName = 'RemoteControlTab'

export default RemoteControlTab
