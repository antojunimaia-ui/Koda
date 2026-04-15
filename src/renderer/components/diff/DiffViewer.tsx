import React, { memo } from 'react'
import { parseDiff } from '../../utils/diff.js'

const DiffViewer = memo(({ output }: { output: string }) => {
  const hunks = parseDiff(output)
  if (hunks.length === 0) return null

  return (
    <div className="mt-1 rounded-md overflow-hidden border border-slate-700/60 text-[11px] font-mono max-h-[420px] overflow-y-auto custom-scrollbar">
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          {/* Hunk header */}
          <div className="px-3 py-1 bg-slate-800/80 text-slate-500 border-b border-slate-700/40 select-none">
            {hunk.header}
          </div>

          {/* Side-by-side rows */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {(() => {
              const rows: React.ReactNode[] = []
              const allLines = hunk.lines

              let i = 0
              while (i < allLines.length) {
                const line = allLines[i]

                if (line.type === 'ctx') {
                  rows.push(
                    <div key={`ctx-l-${i}`} className="px-2 py-0.5 bg-transparent text-slate-500 border-r border-slate-700/30 flex gap-2 min-h-[1.4em]">
                      <span className="text-slate-600 select-none w-6 text-right flex-shrink-0">{line.oldNum}</span>
                      <span className="whitespace-pre-wrap break-all">{line.content || ' '}</span>
                    </div>,
                    <div key={`ctx-r-${i}`} className="px-2 py-0.5 bg-transparent text-slate-500 flex gap-2 min-h-[1.4em]">
                      <span className="text-slate-600 select-none w-6 text-right flex-shrink-0">{line.newNum}</span>
                      <span className="whitespace-pre-wrap break-all">{line.content || ' '}</span>
                    </div>
                  )
                  i++
                } else if (line.type === 'del') {
                  // Collect consecutive del block
                  const delBlock: typeof allLines = []
                  while (i < allLines.length && allLines[i].type === 'del') delBlock.push(allLines[i++])
                  // Collect following add block
                  const addBlock: typeof allLines = []
                  while (i < allLines.length && allLines[i].type === 'add') addBlock.push(allLines[i++])

                  const maxLen = Math.max(delBlock.length, addBlock.length)
                  for (let j = 0; j < maxLen; j++) {
                    const d = delBlock[j]
                    const a = addBlock[j]
                    rows.push(
                      <div key={`del-${i}-${j}`} className={`px-2 py-0.5 flex gap-2 min-h-[1.4em] border-r border-slate-700/30 ${d ? 'bg-rose-950/40 text-rose-300' : 'bg-transparent'}`}>
                        <span className="text-rose-600/60 select-none w-6 text-right flex-shrink-0">{d?.oldNum ?? ''}</span>
                        <span className="whitespace-pre-wrap break-all">{d ? (d.content || ' ') : ''}</span>
                      </div>,
                      <div key={`add-${i}-${j}`} className={`px-2 py-0.5 flex gap-2 min-h-[1.4em] ${a ? 'bg-cyan-950/40 text-cyan-300' : 'bg-transparent'}`}>
                        <span className="text-cyan-600/60 select-none w-6 text-right flex-shrink-0">{a?.newNum ?? ''}</span>
                        <span className="whitespace-pre-wrap break-all">{a ? (a.content || ' ') : ''}</span>
                      </div>
                    )
                  }
                } else if (line.type === 'add') {
                  // Orphan add (no preceding del)
                  rows.push(
                    <div key={`emp-${i}`} className="px-2 py-0.5 bg-transparent border-r border-slate-700/30 min-h-[1.4em]" />,
                    <div key={`add-${i}`} className="px-2 py-0.5 bg-cyan-950/40 text-cyan-300 flex gap-2 min-h-[1.4em]">
                      <span className="text-cyan-600/60 select-none w-6 text-right flex-shrink-0">{line.newNum}</span>
                      <span className="whitespace-pre-wrap break-all">{line.content || ' '}</span>
                    </div>
                  )
                  i++
                } else {
                  i++
                }
              }
              return rows
            })()}
          </div>
        </div>
      ))}
    </div>
  )
})

DiffViewer.displayName = 'DiffViewer'

export default DiffViewer
