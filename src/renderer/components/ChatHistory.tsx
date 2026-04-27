import React, { useState, useEffect } from 'react'
import { MessageSquarePlus } from 'lucide-react'

interface ChatHistoryProps {
  projectPath: string
  onNewSession: () => void
  onLoadSession: (sessionId: string) => void
  isVisible: boolean
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ projectPath, onNewSession, onLoadSession, isVisible }) => {
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; timestamp: number }>>([])
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    if ((isVisible || isHovering) && projectPath) {
      loadSessions()
    }
  }, [isVisible, isHovering, projectPath])

  const loadSessions = async () => {
    try {
      const list = await window.koda.listProjectSessions(projectPath)
      setSessions(list)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const projectName = projectPath.split(/[/\\]/).pop() || 'Project'

  return (
    <div className="absolute left-12 top-0 bottom-0 z-[1050] pointer-events-none">
      {/* Sliding panel */}
      <div
        className={`w-72 h-full bg-[#0a0a0b] border-r border-white/5 flex flex-col transition-transform duration-200 shadow-2xl pointer-events-auto ${
          (isVisible || isHovering) ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="text-white font-bold text-sm mb-1">{projectName}</div>
          <div className="text-slate-500 text-xs">~{projectPath.replace(/^.*[/\\]/, '/')}</div>
        </div>

        {/* New Session Button */}
        <button
          onClick={() => {
            onNewSession()
          }}
          className="mx-3 mt-3 px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-all flex items-center gap-2 text-sm"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Nova sessão
        </button>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-8">
              No sessions yet
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onLoadSession(session.id)
                }}
                className="w-full px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-all group"
              >
                <div className="text-slate-300 text-sm font-medium truncate group-hover:text-white transition-colors">
                  {session.title}
                </div>
                <div className="text-slate-600 text-xs mt-0.5">
                  {formatDate(session.timestamp)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatHistory
