import React, { useState, useEffect, useRef } from 'react'
import { MessageSquarePlus, MoreHorizontal, Trash2 } from 'lucide-react'
import { sessionStorage as kodaSessionStorage } from '../../hooks/useSessionStorage.js'

interface ChatHistoryProps {
  projectPath: string
  onNewSession: () => void
  onLoadSession: (sessionId: string) => void
  isVisible: boolean
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ projectPath, onNewSession, onLoadSession, isVisible }) => {
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; timestamp: number }>>([])
  const [isHovering, setIsHovering] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if ((isVisible || isHovering) && projectPath) {
      loadSessions()
    }
  }, [isVisible, isHovering, projectPath])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadSessions = () => {
    const list = kodaSessionStorage.list(projectPath)
    setSessions(list.map(s => ({ id: s.id, title: s.title, timestamp: s.timestamp })))
  }

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    setMenuOpenId(null)
    kodaSessionStorage.delete(projectPath, sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `${diffMins}m atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString()
  }

  const projectName = projectPath.split(/[/\\]/).pop() || 'Project'

  return (
    <div className="absolute left-12 top-0 bottom-0 z-[1050] pointer-events-none">
      <div
        className={`w-72 h-full bg-[#0a0a0b] border-r border-white/5 flex flex-col transition-transform duration-200 shadow-2xl pointer-events-auto ${
          (isVisible || isHovering) ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setMenuOpenId(null) }}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="text-white font-bold text-sm mb-1">{projectName}</div>
          <div className="text-slate-500 text-xs truncate">{projectPath}</div>
        </div>

        {/* New Session Button */}
        <button
          onClick={onNewSession}
          className="mx-3 mt-3 px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-all flex items-center gap-2 text-sm"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Nova sessão
        </button>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-8">
              Nenhuma sessão ainda
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="relative group">
                <button
                  onClick={() => onLoadSession(session.id)}
                  className="w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-all pr-8"
                >
                  <div className="text-slate-300 text-sm font-medium truncate group-hover:text-white transition-colors">
                    {session.title}
                  </div>
                  <div className="text-slate-600 text-xs mt-0.5">
                    {formatDate(session.timestamp)}
                  </div>
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id) }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {menuOpenId === session.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-1 top-8 z-50 bg-[#141414] border border-white/10 rounded-lg shadow-xl py-1 w-36"
                  >
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Deletar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatHistory
