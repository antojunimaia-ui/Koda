import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface TourStep {
  targetId: string
  title: string
  description: string
  arrowDir: 'up' | 'down' | 'left' | 'right'
  offsetX?: number
  offsetY?: number
}

const STEPS: TourStep[] = [
  {
    targetId: 'tour-cwd',
    title: 'Diretório de trabalho',
    description: 'Clique aqui para escolher a pasta do seu projeto. O Koda vai trabalhar dentro dela — lendo, editando e criando arquivos.',
    arrowDir: 'down',
  },
  {
    targetId: 'tour-input',
    title: 'Fale com o Koda',
    description: 'Digite aqui o que você quer fazer. Pode ser uma tarefa, uma pergunta ou um comando. Use / para ver atalhos disponíveis.',
    arrowDir: 'down',
  },
  {
    targetId: 'tour-mode',
    title: 'Modos de operação',
    description: 'Fast Mode executa direto. Planner Mode cria um plano antes de agir. Teach Mode explica cada passo enquanto trabalha.',
    arrowDir: 'down',
  },
  {
    targetId: 'tour-workspaces',
    title: 'Workspaces',
    description: 'Clique aqui para dividir a tela em dois workspaces lado a lado. Útil para trabalhar em dois projetos ao mesmo tempo.',
    arrowDir: 'down',
  },
  {
    targetId: 'tour-iconbar',
    title: 'Barra lateral',
    description: 'Acesse o terminal integrado, o navegador embutido, o painel de contexto e as configurações. Passe o mouse para ver o histórico de chats.',
    arrowDir: 'right',
  },
]

const STORAGE_KEY = 'koda_onboarding_done'

interface OnboardingTourProps {
  show: boolean
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ show }) => {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; actualDir?: string; targetRect?: DOMRect }>({ top: 0, left: 0 })
  const [ready, setReady] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) return
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Pequeno delay pra UI terminar de renderizar
      setTimeout(() => setVisible(true), 800)
    }
  }, [show])

  useEffect(() => {
    if (!visible) return

    const recalc = () => {
      setReady(false)
      const current = STEPS[step]
      const target = document.getElementById(current.targetId)
      const tw = 280
      const th = tooltipRef.current?.offsetHeight || 160
      const vw = window.innerWidth
      const vh = window.innerHeight

      if (!target) {
        setPos({ top: vh / 2 - th / 2, left: vw / 2 - tw / 2, actualDir: undefined, targetRect: undefined })
        setTimeout(() => setReady(true), 30)
        return
      }

      const rect = target.getBoundingClientRect()
      let top = 0, left = 0
      let actualDir = current.arrowDir

      if (current.arrowDir === 'down') {
        if (rect.top - th - 16 > 8) {
          top = rect.top - th - 16
          actualDir = 'down'
        } else {
          top = rect.bottom + 16
          actualDir = 'up'
        }
        left = rect.left + rect.width / 2 - tw / 2
      } else if (current.arrowDir === 'up') {
        top = rect.bottom + 16
        left = rect.left + rect.width / 2 - tw / 2
        actualDir = 'up'
      } else if (current.arrowDir === 'right') {
        top = rect.top + rect.height / 2 - th / 2
        left = rect.right + 16
        actualDir = 'right'
      } else if (current.arrowDir === 'left') {
        top = rect.top + rect.height / 2 - th / 2
        left = rect.left - tw - 16
        actualDir = 'left'
      }

      left = Math.max(12, Math.min(left, vw - tw - 12))
      top = Math.max(12, Math.min(top, vh - th - 12))

      setPos({ top, left, actualDir, targetRect: rect })
      setTimeout(() => setReady(true), 30)
    }

    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [step, visible])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const targetRect = pos.targetRect
  const actualDir = (pos.actualDir || current.arrowDir) as TourStep['arrowDir']

  // Posição da seta relativa ao tooltip
  const arrowStyle = (): React.CSSProperties => {
    if (!targetRect) return {}
    const tw = 280

    if (actualDir === 'down') {
      const arrowLeft = Math.max(16, Math.min(
        targetRect.left + targetRect.width / 2 - pos.left - 8,
        tw - 32
      ))
      return { bottom: -8, left: arrowLeft, borderTopColor: '#1e1e2e' }
    }
    if (actualDir === 'up') {
      const arrowLeft = Math.max(16, Math.min(
        targetRect.left + targetRect.width / 2 - pos.left - 8,
        tw - 32
      ))
      return { top: -8, left: arrowLeft, borderBottomColor: '#1e1e2e' }
    }
    if (actualDir === 'right') {
      return { left: -8, top: '50%', transform: 'translateY(-50%)', borderRightColor: '#1e1e2e' }
    }
    if (actualDir === 'left') {
      return { right: -8, top: '50%', transform: 'translateY(-50%)', borderLeftColor: '#1e1e2e' }
    }
    return {}
  }

  const arrowBorderClass = {
    down: 'border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent',
    up: 'border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent',
    right: 'border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent',
    left: 'border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent',
  }[actualDir]

  return (
    <>
      {/* Overlay escuro semi-transparente */}
      <div className="fixed inset-0 z-[2000] pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }} />

      {/* Highlight do elemento alvo */}
      {targetRect && (
        <div
          className="fixed z-[2001] rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 2px rgba(99,102,241,0.8)',
            transition: 'all 0.25s ease',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[2002] pointer-events-auto"
        style={{
          top: pos.top,
          left: pos.left,
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.2s ease',
          width: 280,
        }}
      >
        <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl p-4 relative">
          {/* Seta — só aparece se tiver elemento alvo */}
          {targetRect && (
            <div
              className={`absolute w-0 h-0 ${arrowBorderClass}`}
              style={arrowStyle()}
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
              {step + 1} / {STEPS.length}
            </span>
            <button onClick={dismiss} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="text-white font-semibold text-sm mb-1">{current.title}</div>
          <div className="text-slate-500 text-xs leading-relaxed mb-4">{current.description}</div>

          {/* Botões */}
          <div className="flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
            >
              Pular
            </button>
            <button
              onClick={next}
              className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              {step < STEPS.length - 1 ? 'Próximo →' : 'Entendido!'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default OnboardingTour
