import React, { useState, useEffect } from 'react'

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface BrailleSpinnerProps {
  label?: string
  color?: string
}

export const BrailleSpinner: React.FC<BrailleSpinnerProps> = ({ label, color = 'cyan' }) => {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  const colorMap: Record<string, string> = {
    cyan:    'text-[var(--koda-accent)]',
    indigo:  'text-indigo-400',
    yellow:  'text-[var(--koda-status-busy)]',
    green:   'text-[var(--koda-status-ok)]',
    red:     'text-[var(--koda-status-error)]',
    magenta: 'text-[var(--koda-accent-alt)]',
  }

  const textColorClass = colorMap[color] || 'text-cyan'

  return (
    <span className="inline-block whitespace-nowrap">
      <span className={`${textColorClass} font-bold mr-1.5`}>{BRAILLE_FRAMES[frame]}</span>
      {label && <span className="text-slate-500 italic text-xs">{label}</span>}
    </span>
  )
}
