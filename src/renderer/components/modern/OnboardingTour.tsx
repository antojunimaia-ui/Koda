import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface TourStep {
  targetId: string
  title: string
  description: string
  arrowDir: 'up' | 'down' | 'left' | 'right'
}

const MAIN_STEPS: TourStep[] = [
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

const SETTINGS_STEPS: TourStep[] = [
  {
    targetId: 'stour-api',
    title: 'API & Models',
    description: 'Configure seu provedor de IA e chave de API. Escolha entre OpenAI, Anthropic, Google, Koda Cloud e mais 10 provedores.',
    arrowDir: 'right',
  },
  {
    targetId: 'stour-themes',
    title: 'Temas',
    description: 'Personalize as cores do Koda. Escolha entre Tokyo Night, Monokai, Cyberpunk e GitHub Dark — ou edite os valores diretamente.',
    arrowDir: 'right',
  },
  {
    targetId: 'stour-koda',
    title: 'Koda Settings',
    description: 'Controle o que aparece na interface: modo de exibição das ferramentas, posição do terminal e navegador, Iconbar, e modo de UI (Modern ou Classic).',
    arrowDir: 'right',
  },
  {
    targetId: 'stour-remote',
    title: 'Remote Control',
    description: 'Ative um servidor HTTP local para controlar o Koda remotamente via API. Útil para automações, scripts e integração com outras ferramentas.',
    arrowDir: 'right',
  },
  {
    targetId: 'stour-skills',
    title: 'Skills',
    description: 'Instale skills do marketplace para dar ao Koda conhecimento especializado em frameworks, linguagens ou fluxos de trabalho específicos.',
    arrowDir: 'right',
  },
]

const MAIN_STORAGE_KEY = 'koda_onboarding_done'

// ─── Props ────────────────────────────────────────────────────────────────────

interface OnboardingTourProps {
  // Modo principal (ModernUI)
  show?: boolean
  // Modo settings
  mode?: 'settings'
  active?: boolean
  onDone?: () => void
}

// ─── Shared hook ─────────────────────────────────────────────────────────────

function useTour(steps: TourStep[], visible: boolean) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; actualDir?: string; targetRect?: DOMRect }>({ top: 0, left: 0 })
  const [ready, setReady] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) { setStep(0); setReady(false); return }

    const recalc = () => {
      setReady(false)
      const current = steps[step]
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
        if (rect.top - th - 16 > 8) { top = rect.top - th - 16; actualDir = 'down' }
        else { top = rect.bottom + 16; actualDir = 'up' }
        left = rect.left + rect.width / 2 - tw / 2
      } else if (current.arrowDir === 'up') {
        top = rect.bottom + 16; left = rect.left + rect.width / 2 - tw / 2; actualDir = 'up'
      } else if (current.arrowDir === 'right') {
        top = rect.top + rect.height / 2 - th / 2; left = rect.right + 16
      } else {
        top = rect.top + rect.height / 2 - th / 2; left = rect.left - tw - 16
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

  return { step, setStep, pos, ready, tooltipRef }
}

// ─── Shared render ────────────────────────────────────────────────────────────

function TourOverlay({
  steps, step, pos, ready, tooltipRef, onDismiss, onNext, zBase = 2000
}: {
  steps: TourStep[]
  step: number
  pos: { top: number; left: number; actualDir?: string; targetRect?: DOMRect }
  ready: boolean
  tooltipRef: React.RefObject<HTMLDivElement | null>
  onDismiss: () => void
  onNext: () => void
  zBase?: number
}) {
  const current = steps[step]
  const targetRect = pos.targetRect
  const actualDir = (pos.actualDir || current.arrowDir) as TourStep['arrowDir']
  const tw = 280

  const arrowStyle = (): React.CSSProperties => {
    if (!targetRect) return {}
    if (actualDir === 'down') {
      const al = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - pos.left - 8, tw - 32))
      return { bottom: -8, left: al, borderTopColor: '#1e1e2e' }
    }
    if (actualDir === 'up') {
      const al = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - pos.left - 8, tw - 32))
      return { top: -8, left: al, borderBottomColor: '#1e1e2e' }
    }
    if (actualDir === 'right') return { left: -8, top: '50%', transform: 'translateY(-50%)', borderRightColor: '#1e1e2e' }
    return { right: -8, top: '50%', transform: 'translateY(-50%)', borderLeftColor: '#1e1e2e' }
  }

  const arrowClass = {
    down: 'border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent',
    up: 'border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent',
    right: 'border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent',
    left: 'border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent',
  }[actualDir]

  return (
    <>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)', zIndex: zBase }} />
      {targetRect && (
        <div className="fixed rounded-lg pointer-events-none" style={{
          top: targetRect.top - 4, left: targetRect.left - 4,
          width: targetRect.width + 8, height: targetRect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 2px rgba(99,102,241,0.8)',
          transition: 'all 0.25s ease', zIndex: zBase + 1,
        }} />
      )}
      <div ref={tooltipRef} className="fixed pointer-events-auto" style={{
        top: pos.top, left: pos.left,
        opacity: ready ? 1 : 0, transition: 'opacity 0.2s ease',
        width: tw, zIndex: zBase + 2,
      }}>
        <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl p-4 relative">
          {targetRect && <div className={`absolute w-0 h-0 ${arrowClass}`} style={arrowStyle()} />}
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{step + 1} / {steps.length}</span>
            <button onClick={onDismiss} className="text-slate-600 hover:text-slate-400 transition-colors"><X className="w-3 h-3" /></button>
          </div>
          <div className="text-white font-semibold text-sm mb-1">{current.title}</div>
          <div className="text-slate-500 text-xs leading-relaxed mb-4">{current.description}</div>
          <div className="flex items-center justify-between">
            <button onClick={onDismiss} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Pular</button>
            <button onClick={onNext} className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors">
              {step < steps.length - 1 ? 'Próximo →' : 'Entendido!'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

const OnboardingTour: React.FC<OnboardingTourProps> = ({ show, mode, active, onDone }) => {
  // ── Settings mode ──────────────────────────────────────────────────────────
  const isSettings = mode === 'settings'
  const settingsVisible = isSettings && (active ?? false)
  const { step: sStep, setStep: setSStep, pos: sPos, ready: sReady, tooltipRef: sRef } = useTour(SETTINGS_STEPS, settingsVisible)

  if (isSettings) {
    if (!settingsVisible) return null
    return (
      <TourOverlay
        steps={SETTINGS_STEPS}
        step={sStep}
        pos={sPos}
        ready={sReady}
        tooltipRef={sRef}
        zBase={9000}
        onDismiss={() => { localStorage.setItem('koda_settings_tour_done', '1'); onDone?.() }}
        onNext={() => {
          if (sStep < SETTINGS_STEPS.length - 1) {
            setSStep(s => s + 1)
          } else {
            localStorage.setItem('koda_settings_tour_done', '1')
            onDone?.()
          }
        }}
      />
    )
  }

  // ── Main mode ──────────────────────────────────────────────────────────────
  return <MainTour show={show ?? false} />
}

// Componente interno pra manter o estado do tour principal isolado
const MainTour: React.FC<{ show: boolean }> = ({ show }) => {
  const [visible, setVisible] = useState(false)
  const { step, setStep, pos, ready, tooltipRef } = useTour(MAIN_STEPS, visible)

  useEffect(() => {
    if (!show) return
    if (!localStorage.getItem(MAIN_STORAGE_KEY)) {
      setTimeout(() => setVisible(true), 800)
    }
  }, [show])

  const dismiss = () => { setVisible(false); localStorage.setItem(MAIN_STORAGE_KEY, '1') }
  const next = () => step < MAIN_STEPS.length - 1 ? setStep(s => s + 1) : dismiss()

  if (!visible) return null

  return (
    <TourOverlay
      steps={MAIN_STEPS}
      step={step}
      pos={pos}
      ready={ready}
      tooltipRef={tooltipRef}
      onDismiss={dismiss}
      onNext={next}
    />
  )
}

export default OnboardingTour
