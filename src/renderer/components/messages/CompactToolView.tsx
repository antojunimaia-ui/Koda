import React, { memo, useMemo, useState } from 'react'
import { MessageEntry, KodaSettings, AgentInfo } from '../../types/index.js'
import { ChevronRight, FileText, Folder, Globe, Pencil, Search, Terminal, Wrench } from 'lucide-react'
import DiffViewer from '../diff/DiffViewer.js'
import ansi from '../../utils/ansi.js'

interface CompactToolViewProps {
  tools: MessageEntry[]
  settings: KodaSettings
  agentInfo: AgentInfo
  uiMode: 'classic' | 'modern'
  isLastAndActive?: boolean
}

type ToolKind = 'explore' | 'terminal' | 'edit'

/** Terminal tools map to Antigravity's "Ran N commands". */
const TERMINAL_TOOLS = new Set(['shell', 'shell_wait', 'shell_input', 'kill_pty', 'list_pty'])
/** Edit tools map to Antigravity's "Edited N files". */
const EDIT_TOOLS = new Set(['file_edit', 'file_write'])
/** Tools whose value is a file path (used for de-duplicated counting). */
const PATH_TOOLS = new Set(['file_read', 'file_edit', 'file_write', 'file_delete', 'file_move', 'list_dir'])

const basename = (p?: string) => (p ? p.split(/[/\\]/).filter(Boolean).pop() || p : '')
const isRunningStatus = (s: string) => s === 'running' || s === 'writing' || s === 'awaiting_approval'
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const hostOf = (url?: unknown) =>
  url
    ? String(url)
        .replace(/^https?:\/\//, '')
        .split('/')[0]
    : ''

interface ToolRow {
  id: number
  name: string
  kind: ToolKind
  /** Antigravity-style verb, e.g. "Read", "Ran", "Edited". */
  action: string
  /** Target of the action, e.g. "package.json", "npm test". */
  detail: string
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  args?: any
  status: string
  success: boolean
  output?: string
  /** Key used to de-duplicate files in the summary count. */
  dedupeKey?: string
}

function buildRow(msg: MessageEntry): ToolRow | null {
  const tool = msg.tool
  if (!tool) return null

  const name = tool.name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = (tool.args || {}) as any
  const path: string | undefined = args.path
  const file = basename(path)
  const command: string = tool.command || args.command || 'command'

  let kind: ToolKind = 'explore'
  let action = name
  let detail = ''

  if (EDIT_TOOLS.has(name)) {
    kind = 'edit'
    action = name === 'file_write' && tool.isNew ? 'Created' : 'Edited'
    detail = file
  } else if (TERMINAL_TOOLS.has(name)) {
    kind = 'terminal'
    action =
      name === 'shell_wait' ? 'Waited' : name === 'shell_input' ? 'Typed' : name === 'kill_pty' ? 'Killed' : 'Ran'
    detail = name === 'shell' || name === 'shell_wait' ? command : `PTY ${args.pid ?? ''}`.trim()
  } else if (name === 'file_read') {
    action = 'Read'
    detail = file
  } else if (name === 'list_dir') {
    action = 'Listed'
    detail = path || 'directory'
  } else if (name === 'search' || name === 'file_find') {
    action = 'Searched'
    detail = args.pattern || args.query || 'pattern'
  } else if (name === 'web_search') {
    action = 'Searched web'
    detail = args.query || ''
  } else if (name === 'web_fetch' || name === 'browser_agent') {
    action = name === 'web_fetch' ? 'Fetched' : 'Browsed'
    detail = hostOf(args.url) || 'page'
  } else if (name === 'file_delete') {
    action = 'Deleted'
    detail = file
  } else if (name === 'file_move') {
    action = 'Moved'
    detail = file
  } else if (name === 'get_diagnostics') {
    action = 'Checked'
    detail = file || 'workspace'
  } else if (name === 'lsp_query') {
    action = 'Queried'
    detail = args.operation || 'symbols'
  } else if (name === 'questions') {
    const count = args.questions?.length || 1
    action = 'Asked'
    detail = `${count} ${plural(count, 'question', 'questions')}`
  } else if (name === 'load_skill') {
    action = 'Loaded skill'
    detail = args.skill_name || args.name || 'unknown'
  } else if (name === 'enter_plan_mode' || name === 'exit_plan_mode') {
    action = 'Managed'
    detail = name === 'enter_plan_mode' ? 'plan mode' : 'exit plan'
  } else if (name === 'start_collaboration' || name === 'send_to_advisor' || name === 'end_collaboration') {
    action = 'Managed'
    detail =
      name === 'start_collaboration' ? 'collaboration' : name === 'send_to_advisor' ? 'advisor' : 'end collaboration'
  }

  return {
    id: msg.id,
    name,
    kind,
    action,
    detail,
    args,
    status: tool.status,
    success: tool.success,
    output: tool.output,
    dedupeKey: PATH_TOOLS.has(name) && path ? path : undefined,
  }
}

function ActivityIcon({ name, kind }: { name: string; kind: ToolKind }) {
  const cls = 'h-4 w-4 shrink-0 opacity-60'
  if (kind === 'terminal') return <Terminal className={cls} />
  if (kind === 'edit') return <Pencil className={cls} />
  if (name === 'file_read') return <FileText className={cls} />
  if (name === 'list_dir') return <Folder className={cls} />
  if (name === 'search' || name === 'file_find' || name === 'web_search') return <Search className={cls} />
  if (name === 'web_fetch' || name === 'browser_agent') return <Globe className={cls} />
  return <Wrench className={cls} />
}

const CompactToolView = memo(({ tools, uiMode, isLastAndActive }: CompactToolViewProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedOutputs, setExpandedOutputs] = useState<Record<number, boolean>>({})

  const rows = useMemo(() => tools.map(buildRow).filter((r): r is ToolRow => r !== null), [tools])

  if (tools.length === 0) return null

  const toggleOutput = (id: number) => {
    setExpandedOutputs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const isAnyRunning = rows.some((r) => isRunningStatus(r.status))

  // ── Antigravity-style summary ─────────────────────────────────────────────
  // Done: "Explored 3 files, ran 2 commands, edited 1 file" (files de-duplicated)
  // Running: "Reading package.json" / "Running command" / "Thinking"
  const counted = new Set<string>()
  let explored = 0
  let terminal = 0
  let edited = 0

  for (const row of rows) {
    if (row.kind === 'terminal') {
      terminal++
      continue
    }
    if (row.dedupeKey) {
      const key = `${row.kind}:${row.dedupeKey}`
      if (counted.has(key)) continue
      counted.add(key)
    }
    if (row.kind === 'edit') edited++
    else explored++
  }

  const parts: string[] = []
  if (explored > 0) parts.push(`Explored ${explored} ${plural(explored, 'file', 'files')}`)
  if (terminal > 0) parts.push(`${parts.length ? 'ran' : 'Ran'} ${terminal} ${plural(terminal, 'command', 'commands')}`)
  if (edited > 0) parts.push(`${parts.length ? 'edited' : 'Edited'} ${edited} ${plural(edited, 'file', 'files')}`)
  const doneSummary = parts.length > 0 ? parts.join(', ') : 'Done'

  const runningRow = isAnyRunning ? [...rows].reverse().find((r) => isRunningStatus(r.status)) : undefined
  let runningLabel = 'Thinking'
  if (runningRow) {
    switch (runningRow.name) {
      case 'file_read':
        runningLabel = `Reading ${runningRow.detail}`
        break
      case 'list_dir':
        runningLabel = `Listing ${basename(runningRow.detail)}`
        break
      case 'search':
      case 'file_find':
      case 'web_search':
        runningLabel = `Searching ${runningRow.detail}`
        break
      case 'shell':
      case 'shell_wait':
        runningLabel = 'Running command'
        break
      case 'file_edit':
      case 'file_write':
        runningLabel = `Editing ${runningRow.detail}`
        break
      case 'web_fetch':
      case 'browser_agent':
        runningLabel = `Browsing ${runningRow.detail}`
        break
      default:
        runningLabel = 'Exploring'
    }
  }

  const label = isAnyRunning ? runningLabel : isLastAndActive ? 'Thinking' : doneSummary
  const shouldShimmer = isAnyRunning || !!isLastAndActive
  const isModern = uiMode === 'modern'

  return (
    <div className={`flex flex-col my-1 ${isModern ? 'font-sans' : 'font-mono'}`}>
      {/* Trigger — mesmo padrão do tool-group-collapsible do Antigravity */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-label={label}
        title={label}
        onClick={() => setIsExpanded((v) => !v)}
        className={`group flex items-center gap-1 w-full text-left px-2 min-h-8 py-1 rounded-lg tabular-nums select-none cursor-pointer transition-colors hover:bg-slate-800/40 ${
          isModern ? 'text-[13px]' : 'text-[12px]'
        }`}
      >
        <span
          className={`min-w-0 truncate ${shouldShimmer ? 'shimmer-text' : 'text-slate-400 group-hover:text-slate-200'}`}
        >
          {label}
        </span>
        <ChevronRight
          className={`ml-0.5 h-3.5 w-3.5 shrink-0 transition-all duration-200 ${
            isExpanded ? 'rotate-90 text-slate-300' : 'text-slate-600 group-hover:text-slate-400'
          }`}
        />
      </button>

      {/* Conteúdo — indentado, rolável, mesmas dimensões do Antigravity */}
      {isExpanded && (
        <div className="mt-0.5 pl-3 pt-0.5 max-h-[500px] overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
          <div className="flex flex-col gap-0.5">
            {rows.map((row) => {
              const isOutputExpanded = expandedOutputs[row.id] || row.status === 'writing'
              const hasOutput = !!row.output

              return (
                <div key={row.id} className="flex flex-col">
                  <div
                    className={`group/row flex w-full min-w-0 items-center gap-2 min-h-8 py-1 px-2 rounded-lg transition-colors ${
                      hasOutput ? 'cursor-pointer hover:bg-slate-800/40' : ''
                    }`}
                    onClick={() => hasOutput && toggleOutput(row.id)}
                  >
                    <ActivityIcon name={row.name} kind={row.kind} />
                    <span className="min-w-0 truncate text-[12px] text-slate-400">
                      {row.action}
                      {row.detail ? <span className="text-slate-500"> {row.detail}</span> : null}
                    </span>

                    {isRunningStatus(row.status) && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    )}
                    {row.status === 'done' && !row.success && (
                      <span className="ml-auto text-[10px] text-rose-500 shrink-0">✖</span>
                    )}
                    {hasOutput && row.status !== 'writing' && (
                      <ChevronRight
                        className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform duration-200 group-hover/row:text-slate-400 ${
                          isOutputExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    )}
                  </div>

                  {isOutputExpanded && (row.output || (row.status === 'writing' && row.name === 'file_edit')) && (
                    <div className="ml-6 my-1 animate-in fade-in zoom-in-95 duration-200">
                      {row.name === 'file_edit' ? (
                        <DiffViewer
                          output={
                            row.output ||
                            `--- ${row.detail}\n+++ ${row.detail}\n@@ -1,1 +1,1 @@\n${(row.args?.replacement || '')
                              .split('\n')
                              .map((l: string) => '+' + l)
                              .join('\n')}`
                          }
                        />
                      ) : (
                        row.output && (
                          <div className="bg-[#0d1117] border border-slate-700/60 p-2 rounded text-[10px] font-mono overflow-x-auto custom-scrollbar max-h-[300px]">
                            {row.output.split('\n').map((line: string, idx: number) => (
                              <div key={idx} dangerouslySetInnerHTML={{ __html: ansi.toHtml(line) || '&nbsp;' }} />
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

CompactToolView.displayName = 'CompactToolView'

export default CompactToolView
