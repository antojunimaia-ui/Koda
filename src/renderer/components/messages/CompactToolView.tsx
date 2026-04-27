import React, { memo, useState } from 'react'
import { MessageEntry, KodaSettings, AgentInfo } from '../../types/index.js'
import { ChevronRight, ChevronDown } from 'lucide-react'
import DiffViewer from '../diff/DiffViewer.js'
import ansi from '../../utils/ansi.js'

interface CompactToolViewProps {
  tools: MessageEntry[]
  settings: KodaSettings
  agentInfo: AgentInfo
  uiMode: 'classic' | 'modern'
  isLastAndActive?: boolean
}

const CompactToolView = memo(({ tools, settings, agentInfo, uiMode, isLastAndActive }: CompactToolViewProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedOutputs, setExpandedOutputs] = useState<Record<number, boolean>>({})
  
  if (tools.length === 0) return null

  const toggleOutput = (id: number) => {
    setExpandedOutputs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Categorize and count tools
  const counts: Record<string, number> = {
    Read: 0,
    Analyzed: 0,
    Executed: 0,
    Edited: 0,
    Created: 0,
    Searched: 0,
    Browsed: 0,
    Queried: 0,
    Asked: 0,
    Managed: 0,
  }

  let isAnyRunning = false

  const details = tools.map(msg => {
    const tool = msg.tool
    if (!tool) return null

    if (tool.status === 'running' || tool.status === 'writing' || tool.status === 'awaiting_approval') {
      isAnyRunning = true
    }

    let category = 'Executed'
    let value = tool.name

    if (tool.name === 'file_read') {
      category = 'Read'
      value = tool.args?.path?.split(/[/\\]/).pop() || tool.args?.path || 'file'
    } else if (tool.name === 'list_dir') {
      category = 'Analyzed'
      value = tool.args?.path || 'directory'
    } else if (tool.name === 'file_edit') {
      category = 'Edited'
      value = tool.args?.path?.split(/[/\\]/).pop() || tool.args?.path || 'file'
    } else if (tool.name === 'file_write') {
      category = tool.isNew ? 'Created' : 'Edited'
      value = tool.args?.path?.split(/[/\\]/).pop() || tool.args?.path || 'file'
    } else if (tool.name === 'shell' || tool.name === 'shell_wait') {
      category = 'Executed'
      value = tool.command || tool.args?.command || 'command'
    } else if (tool.name === 'search' || tool.name === 'file_find' || tool.name === 'web_search') {
      category = 'Searched'
      value = tool.args?.query || tool.args?.path || 'search'
    } else if (tool.name === 'browser_agent' || tool.name === 'web_fetch') {
      category = 'Browsed'
      value = tool.args?.url ? String(tool.args.url).replace(/^https?:\/\//, '').split('/')[0] : 'page'
    } else if (tool.name === 'lsp_query' || tool.name === 'get_diagnostics') {
      category = 'Queried'
      value = tool.name === 'lsp_query' ? (tool.args?.query || 'code') : 'diagnostics'
    } else if (tool.name === 'questions') {
      category = 'Asked'
      const questionCount = tool.args?.questions?.length || 1
      value = `${questionCount} question${questionCount > 1 ? 's' : ''}`
    } else if (tool.name === 'kill_pty' || tool.name === 'list_pty' || tool.name === 'shell_input') {
      category = 'Managed'
      value = tool.name === 'kill_pty' ? `PTY ${tool.args?.pid || ''}` : (tool.name === 'list_pty' ? 'PTY list' : 'PTY input')
    } else if (tool.name === 'enter_plan_mode' || tool.name === 'exit_plan_mode') {
      category = 'Managed'
      value = tool.name === 'enter_plan_mode' ? 'plan mode' : 'exit plan'
    } else if (tool.name === 'start_collaboration' || tool.name === 'send_to_advisor' || tool.name === 'end_collaboration') {
      category = 'Managed'
      value = tool.name === 'start_collaboration' ? 'collaboration' : (tool.name === 'send_to_advisor' ? 'advisor message' : 'end collaboration')
    } else if (tool.name === 'load_skill') {
      category = 'Managed'
      value = `skill: ${tool.args?.name || 'unknown'}`
    }

    counts[category]++
    return { id: msg.id, name: tool.name, category, value, status: tool.status, success: tool.success, output: tool.output }
  }).filter(Boolean)

  const summary = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([cat, count]) => {
      let noun = 'archive'
      if (cat === 'Browsed') noun = 'session'
      else if (cat === 'Executed') noun = 'command'
      else if (cat === 'Searched') noun = 'query'
      else if (cat === 'Analyzed') noun = 'folder'
      else if (cat === 'Queried') noun = 'query'
      else if (cat === 'Asked') noun = 'question'
      else if (cat === 'Managed') noun = 'action'
      
      const plural = count === 1 ? noun : (noun === 'query' ? 'queries' : noun + 's')
      return `${cat} ${count} ${plural}`
    })
    .join(', ')

  const isModern = uiMode === 'modern'
  const shouldShimmer = isAnyRunning || isLastAndActive

  return (
    <div className={`flex flex-col ml-4 my-2 gap-1 ${isModern ? 'font-sans' : 'font-mono'} text-[12px]`}>
      <div 
        className="flex items-center gap-2 text-slate-400 cursor-pointer hover:text-slate-200 transition-colors group select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {!isModern && (
           <span className={`${isExpanded ? 'text-emerald-400' : 'text-slate-600 group-hover:text-emerald-400'} transition-colors`}>●</span>
        )}
        <span className={`font-bold whitespace-nowrap transition-all ${isModern ? `text-[13px] tracking-tight ${shouldShimmer ? 'shimmer-text text-slate-400' : 'text-slate-500 hover:text-slate-300'}` : ''}`}>
          {summary}
        </span>
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-40" /> : <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
      </div>
      
      {isExpanded && (
        <div className="flex flex-col gap-0.5 ml-1 border-l border-slate-800/60 pl-3 animate-in slide-in-from-top-1 duration-200">
          {details.map((detail, i) => {
            const isOutputExpanded = expandedOutputs[detail!.id] || detail?.status === 'writing'
            const hasOutput = !!detail?.output

            return (
              <div key={detail!.id} className="flex flex-col">
                <div 
                  className={`flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors group ${hasOutput ? 'cursor-pointer' : ''}`}
                  onClick={() => hasOutput && toggleOutput(detail!.id)}
                >
                  <span className="opacity-40 text-[10px]">⎿</span>
                  <span className={`font-bold text-slate-400 group-hover:text-cyan-400 transition-colors ${isModern ? 'text-[11px]' : ''}`}>{detail?.category}:</span>
                  <span className={`truncate max-w-[400px] italic ${isModern ? 'text-[12px]' : ''}`}>{detail?.value}</span>
                  {detail?.status === 'writing' && <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse ml-1" />}
                  {detail?.status === 'done' && (
                    <span className={`text-[10px] ${detail.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {detail.success ? '✔' : '✖'}
                    </span>
                  )}
                  {hasOutput && detail?.status !== 'writing' && (
                    <span className="text-[9px] opacity-40 ml-1">{isOutputExpanded ? 'collapse' : 'view output'}</span>
                  )}
                </div>

                {isOutputExpanded && (detail?.output || (detail?.status === 'writing' && detail?.name === 'file_edit')) && (
                  <div className="ml-4 my-1 animate-in fade-in zoom-in-95 duration-200">
                    {detail.name === 'file_edit' 
                      ? <DiffViewer output={detail.output || `--- ${detail.value}\n+++ ${detail.value}\n@@ -1,1 +1,1 @@\n${(tools.find(t => t.id === detail.id)?.tool?.args?.replacement || '').split('\n').map((l: string) => '+' + l).join('\n')}`} />
                      : (detail.output && (
                        <div className="bg-[#0d1117] border border-slate-700/60 p-2 rounded text-[10px] font-mono overflow-x-auto custom-scrollbar max-h-[300px]">
                          {detail.output.split('\n').map((line: string, idx: number) => (
                            <div key={idx} dangerouslySetInnerHTML={{ __html: ansi.toHtml(line) || '&nbsp;' }} />
                          ))}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

CompactToolView.displayName = 'CompactToolView'

export default CompactToolView
