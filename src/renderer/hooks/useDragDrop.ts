import { useState, useCallback } from 'react'
import { AttachedFile } from '../types/index.js'

interface UseDragDropOptions {
  setInput: React.Dispatch<React.SetStateAction<string>>
  setPendingImages: React.Dispatch<React.SetStateAction<AttachedFile[]>>
}

interface UseDragDropReturn {
  isDragging: boolean
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

/**
 * Handles drag-and-drop of files and images onto the chat area.
 * Images are attached as pending; non-image files are @mentioned.
 */
export function useDragDrop({ setInput, setPendingImages }: UseDragDropOptions): UseDragDropReturn {
  const [isDragging, setIsDragging] = useState(false)

  const handleInjectFile = useCallback((path: string) => {
    setInput(prev => prev + ` @[${path}] `)
  }, [setInput])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const dropped = Array.from(e.dataTransfer.files)
    dropped.forEach(file => {
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader()
        reader.onload = () => {
          setPendingImages(prev => [
            ...prev,
            { 
              dataUrl: reader.result as string, 
              mimeType: file.type, 
              name: file.name,
              isImage: true
            }
          ])
        }
        reader.readAsDataURL(file)
      } else {
        // Non-image: inject @[path] mention using Electron's file.path
        const filePath = (file as unknown as { path: string }).path
        if (filePath) handleInjectFile(filePath)
      }
    })

    setTimeout(() => {
      const inputEl = document.querySelector('textarea')
      inputEl?.focus()
    }, 0)
  }, [handleInjectFile, setPendingImages])

  return { isDragging, handleDragOver, handleDragLeave, handleDrop }
}
