import React, { useEffect, useRef, useState } from 'react'
import type { Workspace } from '../../types/index.js'
import { useUIStore } from '../../stores/uiStore.js'

interface WcvSplitProps {
  workspaces: Workspace[]
  splitIds: [string, string]
  focusedId: string
  onFocus: (id: string) => void
  onCloseSplit: () => void
}

// Zona de arrasto da divisória (barra visível de 4px centralizada nela).
const DIVIDER_W = 16

/**
 * Split via WebContentsView (Fase 2). O host renderiza apenas placeholders
 * (divs) que medem as áreas dos painéis; o main posiciona as views nativas
 * (partition por workspace) em cima com os mesmos bounds. O conteúdo de cada
 * painel é o documento autônomo ?mode=panel&ws=<id> — o app inteiro do host,
 * semeado com aquele workspace (interface idêntica por construção).
 */
const WcvSplit: React.FC<WcvSplitProps> = ({ workspaces, splitIds, focusedId, onFocus }) => {
  const leftWs = workspaces.find((w) => w.id === splitIds[0])
  const rightWs = workspaces.find((w) => w.id === splitIds[1])
  const areaRef = useRef<HTMLDivElement>(null)

  const [ratio, setRatio] = useState(50)
  const isDraggingRef = useRef(false)

  // Overlays globais do host (Settings/Wizard/MCP) escondem os painéis.
  const showSettings = useUIStore((s) => s.showSettings)
  const showMcpSettings = useUIStore((s) => s.showMcpSettings)
  const showWelcomeWizard = useUIStore((s) => s.showWelcomeWizard)
  const overlaysOpen = showSettings || showMcpSettings || showWelcomeWizard

  useEffect(() => {
    window.koda?.panelSetHidden?.(overlaysOpen)
  }, [overlaysOpen])

  // Monta/desmonta conforme os ids mudam.
  useEffect(() => {
    if (!leftWs || !rightWs) return
    window.koda?.panelMount?.(leftWs.id)
    window.koda?.panelMount?.(rightWs.id)
    return () => {
      window.koda?.panelUnmount?.(leftWs.id)
      window.koda?.panelUnmount?.(rightWs.id)
    }
  }, [leftWs?.id, rightWs?.id])

  // Sincroniza bounds — mede a área inteira do split e reparte pelo ratio,
  // em vez de depender dos rects dos placeholders filhos (mais robusto).
  useEffect(() => {
    if (!leftWs || !rightWs) return
    const sync = () => {
      const area = areaRef.current?.getBoundingClientRect()
      if (!area || area.width <= 0 || area.height <= 0) return
      // getBoundingClientRect devolve CSS px; setBounds espera DIP. Com zoom
      // (0.9) o fator outerWidth/innerWidth converte CSS -> DIP corretamente.
      const cssToDip = window.outerWidth / Math.max(1, window.innerWidth)
      // A largura útil ignora a zona da divisória — a 50% os dois painéis
      // ficam exatamente iguais e a barra perfeitamente centralizada.
      const dividerW = DIVIDER_W
      const usable = area.width - dividerW
      const leftW = (usable * ratio) / 100
      const l = {
        x: area.left * cssToDip,
        y: area.top * cssToDip,
        width: leftW * cssToDip,
        height: area.height * cssToDip,
      }
      const r = {
        x: (area.left + leftW + dividerW) * cssToDip,
        y: area.top * cssToDip,
        width: Math.max(1, usable - leftW) * cssToDip,
        height: area.height * cssToDip,
      }
      window.koda?.panelSetBounds?.(leftWs!.id, l)
      window.koda?.panelSetBounds?.(rightWs!.id, r)
    }
    sync()
    const ro = new ResizeObserver(sync)
    if (areaRef.current) ro.observe(areaRef.current)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [leftWs?.id, rightWs?.id, ratio])

  // Foco segue o workspace ativo.
  useEffect(() => {
    if (!leftWs || !rightWs) return
    if (focusedId === leftWs.id) window.koda?.panelFocus?.(leftWs.id)
    else if (focusedId === rightWs.id) window.koda?.panelFocus?.(rightWs.id)
  }, [focusedId, leftWs?.id, rightWs?.id])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !areaRef.current) return
      const rect = areaRef.current.getBoundingClientRect()
      setRatio(Math.max(20, Math.min(80, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!leftWs || !rightWs) return null

  return (
    <div ref={areaRef} className="flex-1 flex flex-row min-h-0 relative">
      <div
        className="min-w-0 h-full"
        style={{ width: `calc((100% - ${DIVIDER_W}px) * ${ratio / 100})` }}
        onClick={() => onFocus(leftWs.id)}
      />
      <div
        onMouseDown={handleMouseDown}
        className="w-4 flex-shrink-0 cursor-col-resize flex items-center justify-center group z-raised"
        title="Arrastar para redimensionar"
      >
        <div
          className="w-1 h-full transition-colors group-hover:bg-indigo-500/50"
          style={{ backgroundColor: 'var(--koda-border)' }}
        />
      </div>
      <div className="flex-1 min-w-0 h-full" onClick={() => onFocus(rightWs.id)} />
    </div>
  )
}

export default WcvSplit
