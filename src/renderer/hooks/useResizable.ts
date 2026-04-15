import { useState, useCallback, useEffect } from 'react'

interface UseResizableReturn {
  leftPanelWidth: number
  browserHeight: number
  isResizing: boolean
  isResizingHeight: boolean
  startResizing: () => void
  startResizingHeight: () => void
}

/**
 * Manages the horizontal (chat/tools split) and vertical
 * (browser/terminal split) resize handles.
 */
export function useResizable(): UseResizableReturn {
  const [leftPanelWidth, setLeftPanelWidth] = useState(50)
  const [browserHeight, setBrowserHeight] = useState(60)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingHeight, setIsResizingHeight] = useState(false)

  // ── Horizontal resize ────────────────────────────────────────────────────
  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = (e.clientX / window.innerWidth) * 100
    if (newWidth > 15 && newWidth < 80) setLeftPanelWidth(newWidth)
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

  // ── Vertical resize ──────────────────────────────────────────────────────
  const startResizingHeight = useCallback(() => setIsResizingHeight(true), [])
  const stopResizingHeight = useCallback(() => setIsResizingHeight(false), [])

  const resizeHeight = useCallback((e: MouseEvent) => {
    if (!isResizingHeight) return
    const containerHeight = window.innerHeight - 40 // TitleBar ~40px
    const newHeight = ((e.clientY - 40) / containerHeight) * 100
    if (newHeight > 15 && newHeight < 85) setBrowserHeight(newHeight)
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

  return {
    leftPanelWidth,
    browserHeight,
    isResizing,
    isResizingHeight,
    startResizing,
    startResizingHeight,
  }
}
