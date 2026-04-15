// ─── Diff Parser ─────────────────────────────────────────────────────────────

export interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'hdr'
  content: string
  oldNum?: number
  newNum?: number
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export function parseDiff(raw: string): DiffHunk[] {
  // Strip ANSI escape codes
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '')
  const lines = clean.split('\n')
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) {
        oldLine = parseInt(m[1])
        newLine = parseInt(m[2])
      }
      current = { header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (!current) continue

    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.lines.push({ type: 'add', content: line.slice(1), newNum: newLine++ })
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.lines.push({ type: 'del', content: line.slice(1), oldNum: oldLine++ })
    } else if (!line.startsWith('+++') && !line.startsWith('---') && !line.startsWith('\\')) {
      current.lines.push({ type: 'ctx', content: line.slice(1), oldNum: oldLine++, newNum: newLine++ })
    }
  }

  return hunks
}
