import React, { memo, useState, useCallback } from 'react'
import type { Question, QuestionAnswer } from '../../types/index.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionsModalProps {
  questions: Question[]
  onSubmit: (answers: QuestionAnswer[]) => void
  variant?: 'modern' | 'classic'
}

// ─── Inline Panel (sits above the prompt box) ─────────────────────────────────

const QuestionsModal = memo(({ questions, onSubmit, variant = 'modern' }: QuestionsModalProps) => {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() =>
    questions.map((q, i) => ({ index: i, question: q.question, selected: [] }))
  )

  const current = questions[step]
  const currentAnswer = answers[step]
  const isLast = step === questions.length - 1
  const hasSelection = currentAnswer.selected.length > 0

  const toggleOption = useCallback((label: string) => {
    setAnswers(prev => {
      const updated = [...prev]
      const entry = { ...updated[step] }

      if (current.multiple) {
        entry.selected = entry.selected.includes(label)
          ? entry.selected.filter(l => l !== label)
          : [...entry.selected, label]
      } else {
        entry.selected = [label]
      }

      updated[step] = entry
      return updated
    })
  }, [step, current.multiple])

  const handleNext = useCallback(() => {
    if (!hasSelection) return
    if (isLast) {
      onSubmit(answers)
    } else {
      setStep(s => s + 1)
    }
  }, [hasSelection, isLast, answers, onSubmit])

  const handleBack = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  return (
    <div className={`w-full bg-neutral-900/90 border border-neutral-700/60 backdrop-blur-xl shadow-lg overflow-hidden
      ${variant === 'modern'
        ? 'rounded-2xl rounded-b-none border-b-0'
        : 'rounded-xl rounded-b-none border-b-0 mb-0'
      }
    `}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-white font-black text-[10px] uppercase tracking-[0.2em]">
            {current.header || 'Question'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {current.multiple && (
            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">múltipla escolha</span>
          )}
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-3 h-1.5 bg-violet-400'
                    : i < step
                    ? 'w-1.5 h-1.5 bg-violet-600/60'
                    : 'w-1.5 h-1.5 bg-neutral-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Question text */}
      <div className="px-4 pb-3">
        <p className="text-white text-sm font-medium leading-snug">{current.question}</p>
      </div>

      {/* Options */}
      <div className="px-4 pb-3 flex flex-col gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
        {current.options.map((opt) => {
          const isSelected = currentAnswer.selected.includes(opt.label)
          return (
            <button
              key={opt.label}
              onClick={() => toggleOption(opt.label)}
              className={`
                w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 active:scale-[0.99]
                ${isSelected
                  ? 'border-violet-500/50 bg-violet-500/10 text-white'
                  : 'border-neutral-700/50 bg-neutral-800/40 text-slate-300 hover:border-neutral-600 hover:bg-neutral-800/70'
                }
              `}
            >
              <div className="flex items-start gap-2.5">
                {/* Indicator */}
                <div className={`
                  mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-${current.multiple ? 'sm' : 'full'} border-2 flex items-center justify-center transition-all
                  ${isSelected ? 'border-violet-400 bg-violet-500' : 'border-neutral-600'}
                `}>
                  {isSelected && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 10">
                      {current.multiple
                        ? <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        : <circle cx="5" cy="5" r="2.5" fill="currentColor" />
                      }
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold leading-tight">{opt.label}</div>
                  {opt.description && (
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{opt.description}</div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex gap-2">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="px-3 py-1.5 rounded-lg border border-neutral-700/60 bg-neutral-800/30 text-slate-400 text-[10px] font-bold hover:bg-neutral-800/60 transition-all active:scale-95 uppercase tracking-wider"
          >
            ← Voltar
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!hasSelection}
          className={`
            flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95
            ${hasSelection
              ? isLast
                ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'border border-violet-500/30 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25'
              : 'border border-neutral-700/40 bg-neutral-800/20 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          {isLast ? 'Confirmar ✓' : 'Próxima →'}
        </button>
      </div>

    </div>
  )
})

QuestionsModal.displayName = 'QuestionsModal'

export default QuestionsModal
export type { QuestionsModalProps }
