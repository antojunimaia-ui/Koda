import { useState, useCallback, useEffect } from 'react'

interface UseResizableReturn {
  leftPanelWidth: number
  rightPanelWidth: number
  browserHeight: number
  contextPanelWidth: number
  explorerWidth: number
  isResizing: boolean
  isResizingRight: boolean
  isResizingHeight: boolean
  isResizingContext: boolean
  isResizingExplorer: boolean
  startResizing: () => void
  startResizingRight: () => void
  startResizingHeight: () => void
  startResizingContext: () => void
  startResizingExplorer: () => void
}

/**
 * Manages the horizontal (left/right panels) and vertical
 * (browser/terminal split) resize handles.
 */
export function useResizable(): UseResizableReturn {
  const [leftPanelWidth, setLeftPanelWidth] = useState(30)
  const [rightPanelWidth, setRightPanelWidth] = useState(30)
  const [browserHeight, setBrowserHeight] = useState(60)
  const [contextPanelWidth, setContextPanelWidth] = useState(256)
  const [explorerWidth, setExplorerWidth] = useState(256)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const [isResizingHeight, setIsResizingHeight] = useState(false)
  const [isResizingContext, setIsResizingContext] = useState(false)
  const [isResizingExplorer, setIsResizingExplorer] = useState(false)

  // ── Left Horizontal resize ────────────────────────────────────────────────────
  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = (e.clientX / window.innerWidth) * 100
    if (newWidth > 10 && newWidth < 80) setLeftPanelWidth(newWidth)
  }, [isResizing])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  // ── Right Horizontal resize ───────────────────────────────────────────────────
  const startResizingRight = useCallback(() => setIsResizingRight(true), [])
  const stopResizingRight = useCallback(() => setIsResizingRight(false), [])

  const resizeRight = useCallback((e: MouseEvent) => {
    if (!isResizingRight) return
    const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100
    if (newWidth > 10 && newWidth < 80) setRightPanelWidth(newWidth)
  }, [isResizingRight])

  useEffect(() => {
    if (isResizingRight) {
      window.addEventListener('mousemove', resizeRight)
      window.addEventListener('mouseup', stopResizingRight)
    } else {
      window.removeEventListener('mousemove', resizeRight)
      window.removeEventListener('mouseup', stopResizingRight)
    }
    return () => {
      window.removeEventListener('mousemove', resizeRight)
      window.removeEventListener('mouseup', stopResizingRight)
    }
  }, [isResizingRight, resizeRight, stopResizingRight])

  // ── Vertical resize ──────────────────────────────────────────────────────
  const startResizingHeight = useCallback(() => setIsResizingHeight(true), [])
  const stopResizingHeight = useCallback(() => setIsResizingHeight(false), [])

  const resizeHeight = useCallback((e: MouseEvent) => {
    if (!isResizingHeight) return
    const containerHeight = window.innerHeight - 40 // TitleBar ~40px
    const newHeight = ((e.clientY - 40) / containerHeight) * 100
    if (newHeight > 10 && newHeight < 90) setBrowserHeight(newHeight)
  }, [isResizingHeight])

  useEffect(() => {
    if (isResizingHeight) {
      window.addEventListener('mousemove', resizeHeight)
      window.addEventListener('mouseup', stopResizingHeight)
    } else {
      window.removeEventListener('mousemove', resizeHeight)
      window.removeEventListener('mouseup', stopResizingHeight)
    }
    return () => {
      window.removeEventListener('mousemove', resizeHeight)
      window.removeEventListener('mouseup', stopResizingHeight)
    }
  }, [isResizingHeight, resizeHeight, stopResizingHeight])

  // ── Context Panel resize (right side, px-based) ──────────────────────────
  const startResizingContext = useCallback(() => setIsResizingContext(true), [])
  const stopResizingContext = useCallback(() => setIsResizingContext(false), [])

  const resizeContext = useCallback((e: MouseEvent) => {
    if (!isResizingContext) return
    const newWidth = Math.max(180, Math.min(520, window.innerWidth - e.clientX))
    setContextPanelWidth(newWidth)
  }, [isResizingContext])

  useEffect(() => {
    if (isResizingContext) {
      window.addEventListener('mousemove', resizeContext)
      window.addEventListener('mouseup', stopResizingContext)
    } else {
      window.removeEventListener('mousemove', resizeContext)
      window.removeEventListener('mouseup', stopResizingContext)
    }
    return () => {
      window.removeEventListener('mousemove', resizeContext)
      window.removeEventListener('mouseup', stopResizingContext)
    }
  }, [isResizingContext, resizeContext, stopResizingContext])

  // ── Explorer Panel resize (right side, px-based) ──────────────────────────
  const startResizingExplorer = useCallback(() => setIsResizingExplorer(true), [])
  const stopResizingExplorer = useCallback(() => setIsResizingExplorer(false), [])

  const resizeExplorer = useCallback((e: MouseEvent) => {
    if (!isResizingExplorer) return
    const newWidth = Math.max(180, Math.min(520, window.innerWidth - e.clientX))
    setExplorerWidth(newWidth)
  }, [isResizingExplorer])

  useEffect(() => {
    if (isResizingExplorer) {
      window.addEventListener('mousemove', resizeExplorer)
      window.addEventListener('mouseup', stopResizingExplorer)
    } else {
      window.removeEventListener('mousemove', resizeExplorer)
      window.removeEventListener('mouseup', stopResizingExplorer)
    }
    return () => {
      window.removeEventListener('mousemove', resizeExplorer)
      window.removeEventListener('mouseup', stopResizingExplorer)
    }
  }, [isResizingExplorer, resizeExplorer, stopResizingExplorer])

  return {
    leftPanelWidth,
    rightPanelWidth,
    browserHeight,
    contextPanelWidth,
    explorerWidth,
    isResizing,
    isResizingRight,
    isResizingHeight,
    isResizingContext,
    isResizingExplorer,
    startResizing,
    startResizingRight,
    startResizingHeight,
    startResizingContext,
    startResizingExplorer,
  }
}
