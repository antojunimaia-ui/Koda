import React, { useState, useEffect, memo } from 'react'

const RemoteControlTab = memo(() => {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('koda_koclaw_enabled') === 'true')
  const [token, setToken] = useState(() => localStorage.getItem('koda_koclaw_token') || '')
  const [channelId, setChannelId] = useState(() => localStorage.getItem('koda_koclaw_channel') || '')
  const [status, setStatus] = useState<{ running: boolean; ready: boolean; username: string | null }>({ running: false, ready: false, username: null })
  const [error, setError] = useState('')
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    window.koda.koClawStatus().then(setStatus)
  }, [])

  const handleToggle = async (val: boolean) => {
    setEnabled(val)
    setError('')
    localStorage.setItem('koda_koclaw_enabled', String(val))
    if (val) {
      if (!token) { setError('Paste your Discord bot token first.'); setEnabled(false); return }
      const res = await window.koda.koClawStart({ token, channelId: channelId || undefined })
      if (!res.success) { setError(res.error || 'Failed to start'); setEnabled(false); return }
    } else {
      await window.koda.koClawStop()
    }
    const s = await window.koda.koClawStatus()
    setStatus(s)
  }

  const handleSaveConfig = async () => {
    localStorage.setItem('koda_koclaw_token', token)
    localStorage.setItem('koda_koclaw_channel', channelId)
    if (enabled) {
      await window.koda.koClawStop()
      const res = await window.koda.koClawStart({ token, channelId: channelId || undefined })
      if (!res.success) setError(res.error || 'Failed to restart')
      const s = await window.koda.koClawStatus()
      setStatus(s)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-left-2 duration-300">

      {/* Header */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-1">
          <span className="w-1.5 h-4 bg-indigo-400 rounded-full" />
          KoClaw — Discord Bot
        </h3>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          Control Koda directly from Discord. Send messages to the bot and it will execute tasks and respond with results. Perfect for remote work and team collaboration.
        </p>
      </section>

      {/* Status + toggle */}
      <div className="flex items-center justify-between bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${status.running && status.ready ? 'bg-indigo-400 animate-pulse' : status.running ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
          <div>
            <span className="text-xs font-bold text-slate-200">
              {status.running && status.ready ? `Online — ${status.username}` : status.running ? 'Connecting...' : 'Offline'}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {status.running && status.ready ? 'Ready to receive messages' : status.running ? 'Logging in to Discord...' : 'Bot is not running'}
            </p>
          </div>
        </div>
        <button
          onClick={() => handleToggle(!enabled)}
          className={`w-10 h-5 rounded-full relative transition-all ${enabled && status.running ? 'bg-indigo-500' : 'bg-slate-700'}`}
        >
          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${enabled && status.running ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {error && <p className="text-rose-400 text-[11px]">⚠ {error}</p>}

      {/* Config */}
      <div className="flex flex-col gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Discord Bot Token</label>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste your Discord bot token here..."
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 transition-colors"
            />
            <button onClick={() => setShowToken(p => !p)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-all">{showToken ? '🙈' : '👁'}</button>
          </div>
          <p className="text-[10px] text-slate-500">
            Create a bot at <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Discord Developer Portal</a>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Channel ID (Optional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              placeholder="Leave empty to respond in DMs and all channels"
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 transition-colors"
            />
            <button onClick={handleSaveConfig} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">Apply</button>
          </div>
          <p className="text-[10px] text-slate-500">
            If set, the bot will only respond in this specific channel. Otherwise, it responds to DMs and all channels.
          </p>
        </div>
      </div>

      {/* Setup Guide */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
          <span className="w-1.5 h-4 bg-emerald-400 rounded-full" />
          Setup Guide
        </h3>
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800/40 px-4 py-3 rounded-lg border border-slate-700/40">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 font-black text-sm flex-shrink-0">1.</span>
              <div>
                <p className="text-slate-200 text-xs font-bold mb-1">Create a Discord Bot</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Discord Developer Portal</a>, create a new application, then go to the "Bot" tab and create a bot.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 px-4 py-3 rounded-lg border border-slate-700/40">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 font-black text-sm flex-shrink-0">2.</span>
              <div>
                <p className="text-slate-200 text-xs font-bold mb-1">Enable Required Intents</p>
                <p className="text-slate-400 text-[10px] leading-relaxed mb-2">
                  In the Bot settings, enable these Privileged Gateway Intents:
                </p>
                <ul className="text-slate-400 text-[10px] leading-relaxed list-disc list-inside space-y-1">
                  <li><code className="bg-slate-900 px-1 rounded">MESSAGE CONTENT INTENT</code></li>
                  <li><code className="bg-slate-900 px-1 rounded">SERVER MEMBERS INTENT</code> (optional)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 px-4 py-3 rounded-lg border border-slate-700/40">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 font-black text-sm flex-shrink-0">3.</span>
              <div>
                <p className="text-slate-200 text-xs font-bold mb-1">Copy Bot Token</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Click "Reset Token" to generate a new token, copy it and paste it in the field above.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 px-4 py-3 rounded-lg border border-slate-700/40">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 font-black text-sm flex-shrink-0">4.</span>
              <div>
                <p className="text-slate-200 text-xs font-bold mb-1">Invite Bot to Server</p>
                <p className="text-slate-400 text-[10px] leading-relaxed mb-2">
                  Go to OAuth2 → URL Generator, select these scopes and permissions:
                </p>
                <ul className="text-slate-400 text-[10px] leading-relaxed list-disc list-inside space-y-1 mb-2">
                  <li>Scopes: <code className="bg-slate-900 px-1 rounded">bot</code></li>
                  <li>Permissions: <code className="bg-slate-900 px-1 rounded">Send Messages</code>, <code className="bg-slate-900 px-1 rounded">Read Message History</code></li>
                </ul>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Copy the generated URL and open it in your browser to invite the bot to your server.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 px-4 py-3 rounded-lg border border-slate-700/40">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 font-black text-sm flex-shrink-0">5.</span>
              <div>
                <p className="text-slate-200 text-xs font-bold mb-1">Start KoClaw</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Toggle the switch above to start the bot. Once online, send a message to the bot in Discord and it will execute your task!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
          <span className="w-1.5 h-4 bg-amber-400 rounded-full" />
          Usage Examples
        </h3>
        <div className="flex flex-col gap-2">
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400 text-[10px] mb-2">Send a message to the bot:</p>
            <code className="text-indigo-300 text-xs font-mono">Fix the login bug in auth.ts</code>
          </div>
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400 text-[10px] mb-2">Ask a question:</p>
            <code className="text-indigo-300 text-xs font-mono">How does the payment flow work?</code>
          </div>
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400 text-[10px] mb-2">Create new features:</p>
            <code className="text-indigo-300 text-xs font-mono">Add dark mode support to the settings page</code>
          </div>
        </div>
      </section>

    </div>
  )
})

RemoteControlTab.displayName = 'RemoteControlTab'
export default RemoteControlTab
