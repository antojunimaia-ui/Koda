import React, { memo, useState } from 'react'
import { MessageEntry, KodaSettings, AgentInfo } from '../../types/index.js'
import { ChevronRight } from 'lucide-react'
import AssistantMessage from './AssistantMessage.js'
import CompactToolView from './CompactToolView.js'
import { formatDuration } from '../../utils/formatDuration.js'

interface CompactTurnViewProps {
  entries: MessageEntry[]
  settings: KodaSettings
  agentInfo: AgentInfo
  uiMode: 'classic' | 'modern'
  isLastAndActive?: boolean
}

type Segment = { kind: 'text'; msg: MessageEntry } | { kind: 'tools'; key: string; msgs: MessageEntry[] }

/** Duração do turno a partir dos timestamps das entradas (undefined em sessões antigas). */
function turnDuration(entries: MessageEntry[]): number | undefined {
  const times = entries.flatMap((e) => [e.createdAt, e.completedAt]).filter((t): t is number => typeof t === 'number')
  if (times.length < 2) return undefined
  return Math.max(...times) - Math.min(...times)
}

function buildSegments(entries: MessageEntry[]): Segment[] {
  const segments: Segment[] = []
  for (const entry of entries) {
    if (entry.type === 'tool') {
      const last = segments[segments.length - 1]
      if (last && last.kind === 'tools') last.msgs.push(entry)
      else segments.push({ kind: 'tools', key: `tools-${entry.id}`, msgs: [entry] })
    } else if (entry.type === 'assistant') {
      segments.push({ kind: 'text', msg: entry })
    }
  }
  return segments
}

/**
 * Renders one full agent turn as a single block (Antigravity style):
 * - while running: one avatar, text and tool groups inline and contiguous;
 * - when finished: everything collapses under "Worked for Xs" (expandable),
 *   with the final response left visible below it.
 */
const CompactTurnView = memo(({ entries, settings, agentInfo, uiMode, isLastAndActive }: CompactTurnViewProps) => {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  const active = !!isLastAndActive
  const duration = turnDuration(entries)

  // A resposta final (último texto do assistente) fica sempre visível fora do colapso.
  let tailIndex = -1
  if (!active) {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].type === 'assistant') {
        tailIndex = i
        break
      }
    }
  }

  const workEntries = tailIndex >= 0 ? entries.slice(0, tailIndex) : entries
  const tailEntry = tailIndex >= 0 ? entries[tailIndex] : undefined
  const canCollapse = !active && workEntries.length > 0 && duration !== undefined
  const showWork = !canCollapse || expanded
  const isModern = uiMode === 'modern'

  return (
    <div className="flex flex-col ml-4 text-sm">
      {/* Um único avatar por turno — igual ao Antigravity */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0">
          {active ? (
            <video
              src="/Loading.webm"
              autoPlay
              loop
              muted
              className="w-7 h-7 object-contain border-0 outline-0"
              style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
            />
          ) : (
            <img
              src="/icon.png"
              alt="Koda"
              className="w-7 h-7 object-contain border-0 outline-0"
              style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
            />
          )}
        </div>
        <span
          className={isModern ? 'font-bold text-slate-300 text-sm' : 'font-bold opacity-60 text-sm'}
          style={isModern ? undefined : { color: 'var(--koda-accent)' }}
        >
          Koda
        </span>
      </div>

      {/* "Worked for Xs" — trigger do worked-for-collapsible do Antigravity */}
      {canCollapse && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`Worked for ${formatDuration(duration)}`}
          onClick={() => setExpanded((v) => !v)}
          className={`group flex items-center gap-1 w-full text-left px-2 min-h-8 py-1 rounded-lg tabular-nums select-none cursor-pointer transition-colors hover:bg-slate-800/40 ${
            isModern ? 'text-[13px]' : 'text-[12px]'
          }`}
        >
          <span className="min-w-0 truncate text-slate-500 group-hover:text-slate-300">
            Worked for {formatDuration(duration)}
          </span>
          <ChevronRight
            className={`ml-0.5 h-3.5 w-3.5 shrink-0 transition-all duration-200 ${
              expanded ? 'rotate-90 text-slate-300' : 'text-slate-600 group-hover:text-slate-400'
            }`}
          />
        </button>
      )}

      {/* Processo de trabalho (textos intermediários + grupos de tools) */}
      {showWork && (
        <div className="flex flex-col">
          {buildSegments(workEntries).map((seg) =>
            seg.kind === 'text' ? (
              <AssistantMessage
                key={seg.msg.id}
                text={seg.msg.text}
                done={seg.msg.done}
                uiMode={uiMode}
                showAvatar={false}
              />
            ) : (
              <CompactToolView
                key={seg.key}
                tools={seg.msgs}
                settings={settings}
                agentInfo={agentInfo}
                uiMode={uiMode}
                isLastAndActive={false}
              />
            ),
          )}
        </div>
      )}

      {/* Resposta final — sempre visível, como no Antigravity */}
      {tailEntry && (
        <AssistantMessage text={tailEntry.text} done={tailEntry.done ?? !active} uiMode={uiMode} showAvatar={false} />
      )}
    </div>
  )
})

CompactTurnView.displayName = 'CompactTurnView'

export default CompactTurnView
