import React, { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, MoreHorizontal, MessageSquare } from 'lucide-react'
import { sessionStorage as kodaSessionStorage, ProjectSummary } from '../../hooks/useSessionStorage.js'

interface ChatHistoryProps {
  projectPath: string
  onNewSession: () => void
  onLoadSession: (sessionId: string, targetProjectPath?: string) => void
  isVisible: boolean
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ projectPath, onNewSession, onLoadSession, isVisible }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProjects()
  }, [isVisible, projectPath])

  const loadProjects = () => {
    let all = kodaSessionStorage.listAllProjects()
    
    // Ensure current project is included even if it has no sessions yet
    if (projectPath && !all.some(p => p.path === projectPath)) {
      const name = projectPath.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() || projectPath
      all.unshift({
        path: projectPath,
        name,
        lastActive: Date.now(),
        sessions: kodaSessionStorage.list(projectPath),
      })
    }

    setProjects(all)

    // Expand current project folder by default
    if (projectPath) {
      setExpandedFolders(prev => ({
        ...prev,
        [projectPath]: prev[projectPath] !== undefined ? prev[projectPath] : true
      }))
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        onNewSession()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNewSession])

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }))
  }

  const handleDelete = (e: React.MouseEvent, pPath: string, sessionId: string) => {
    e.stopPropagation()
    setMenuOpenId(null)
    kodaSessionStorage.delete(pPath, sessionId)
    loadProjects()
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none font-sans text-zinc-300">
      {/* Pane Header — VSCode style */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Agent Sessions</span>
        <button
          onClick={onNewSession}
          className="text-zinc-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-[11px]"
          title="New Session (Ctrl+N)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sessions Tree List — VSCode monaco-list-row style */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1 py-1 space-y-1">
        {projects.length === 0 ? (
          <div className="px-3 py-6 text-[12px] text-zinc-500 text-center">
            No agent sessions recorded yet
          </div>
        ) : (
          projects.map((project) => {
            const isExpanded = !!expandedFolders[project.path]
            const isCurrent = project.path === projectPath

            return (
              <div key={project.path} className="space-y-0.5">
                {/* VSCode Section Header (Repository / Project Group) */}
                <div
                  onClick={() => toggleFolder(project.path)}
                  className={`group px-1.5 py-1 rounded-md flex items-center justify-between cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-white/8 text-white font-medium'
                      : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={project.path}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                    <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide uppercase truncate text-zinc-300 group-hover:text-white">
                      {project.name}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2">
                    {project.sessions.length}
                  </span>
                </div>

                {/* Sub-items (VSCode Agent Session Items) */}
                {isExpanded && (
                  <div className="ml-3 pl-2 border-l border-white/8 space-y-0.5 py-0.5">
                    {project.sessions.length === 0 ? (
                      <div className="px-2 py-1 text-[11px] text-zinc-600 italic">
                        No sessions
                      </div>
                    ) : (
                      project.sessions.map((session) => (
                        <div key={session.id} className="relative group">
                          <button
                            onClick={() => onLoadSession(session.id, project.path)}
                            className="w-full px-2 py-1.5 rounded-md text-left transition-all hover:bg-white/8 flex items-start gap-2 pr-7 group-hover:text-white"
                          >
                            {/* Status / Type Icon (Column 1) */}
                            <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5 text-zinc-400 group-hover:text-white">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>

                            {/* Main Content Column (VSCode Title + Details Row) */}
                            <div className="flex-1 overflow-hidden">
                              {/* Title Row */}
                              <div className="text-[13px] text-zinc-200 group-hover:text-white font-normal truncate leading-snug">
                                {session.title}
                              </div>

                              {/* Details Row (Provider badge · Time) */}
                              <div className="flex items-center gap-1 text-[11px] text-zinc-500 mt-0.5 font-mono">
                                <span>Koda</span>
                                <span>·</span>
                                <span>{formatDate(session.timestamp)}</span>
                              </div>
                            </div>
                          </button>

                          {/* Hover Menu Action (VSCode Title Toolbar style) */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id) }}
                            className="absolute right-1 top-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-all"
                            title="More Actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {menuOpenId === session.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-1 top-7 z-50 bg-[#18181b] border border-white/10 rounded-md shadow-2xl py-1 w-32"
                            >
                              <button
                                onClick={(e) => handleDelete(e, project.path, session.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Session
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default ChatHistory


