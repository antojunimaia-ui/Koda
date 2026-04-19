import React, { useState, useEffect } from 'react'

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const THINKING_PHRASES = [
  'Thinking...',
  'Reading the codebase...',
  'Connecting the dots...',
  'Cooking something up...',
  'On it...',
  'Figuring this out...',
  'Almost there...',
  'Assembling the pieces...',
  'Deep in thought...',
  'Crunching the context...',
  'Mapping the architecture...',
  'Scanning for patterns...',
]

interface BrailleSpinnerProps {
  label?: string
  color?: string
  /** If true, cycles through THINKING_PHRASES every `phraseInterval` ms instead of showing a static label */
  rotateLabel?: boolean
  phraseInterval?: number
}

export const BrailleSpinner: React.FC<BrailleSpinnerProps> = ({
  label,
  color = 'cyan',
  rotateLabel = false,
  phraseInterval = 2500,
}) => {
  const [frame, setFrame] = useState(0)
  const [phraseIndex, setPhraseIndex] = useState(() =>
    Math.floor(Math.random() * THINKING_PHRASES.length)
  )
  const [visible, setVisible] = useState(true)

  // Braille animation
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  // Phrase rotation with fade
  useEffect(() => {
    if (!rotateLabel) return
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length)
        setVisible(true)
      }, 300)
    }, phraseInterval)
    return () => clearInterval(timer)
  }, [rotateLabel, phraseInterval])

  const colorMap: Record<string, string> = {
    cyan:    'text-[var(--koda-accent)]',
    indigo:  'text-indigo-400',
    yellow:  'text-[var(--koda-status-busy)]',
    green:   'text-[var(--koda-status-ok)]',
    red:     'text-[var(--koda-status-error)]',
    magenta: 'text-[var(--koda-accent-alt)]',
  }

  const textColorClass = colorMap[color] || 'text-cyan'
  const displayLabel = rotateLabel ? THINKING_PHRASES[phraseIndex] : label

  return (
    <span className="inline-block whitespace-nowrap">
      <span className={`${textColorClass} font-bold mr-1.5`}>{BRAILLE_FRAMES[frame]}</span>
      {displayLabel && (
        <span
          className="text-slate-500 italic text-xs transition-opacity duration-300"
          style={{ opacity: rotateLabel ? (visible ? 1 : 0) : 1 }}
        >
          {displayLabel}
        </span>
      )}
    </span>
  )
}
