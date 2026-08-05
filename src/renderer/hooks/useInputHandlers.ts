import { useState, useRef, useCallback } from 'react'
import { SlashItem } from '../types/index.js'

const STATIC_COMMANDS = [
  { name: '/help',   description: 'Show available commands',     icon: '❓' },
  { name: '/clear',  description: 'Clear chat messages',         icon: '🗑️' },
  { name: '/reset',  description: 'Reset conversation memory',   icon: '♻️' },
  { name: '/tokens', description: 'Show token usage estimate',   icon: '📊' },
  { name: '/model',  description: 'View or switch active model', icon: '🤖' },
  { name: '/apikey', description: 'Set API key inline',          icon: '🔑' },
]

interface UseInputHandlersOptions {
  input: string
  setInput: (val: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  availableSkills: Array<{ name: string; description: string }>
}

export function useInputHandlers({
  input,
  setInput,
  inputRef,
  availableSkills,
}: UseInputHandlersOptions) {
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [suggestionTriggerPos, setSuggestionTriggerPos] = useState(-1)

  const [slashItems, setSlashItems] = useState<SlashItem[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)

  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const handleInputChange = useCallback(async (val: string) => {
    setInput(val)
    const cursor = inputRef.current?.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)

    // Slash command menu
    const slashMatch = val.match(/^\/(\S*)/)
    if (slashMatch) {
      const query = slashMatch[1].toLowerCase()
      const skillItems = availableSkills.map(s => ({
        name: `/${s.name}`,
        description: s.description,
        icon: '🎯',
        isSkill: true as const,
      }))
      const allItems = [...STATIC_COMMANDS, ...skillItems]
      const filtered = query ? allItems.filter(c => c.name.slice(1).startsWith(query)) : allItems
      setSlashItems(filtered)
      setShowSlashMenu(filtered.length > 0)
      setSlashIndex(0)
      return
    }
    setShowSlashMenu(false)

    // @file suggestions
    const atMatch = textBefore.match(/@(\S*)$/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      setSuggestionTriggerPos(atMatch.index!)
      let files = allFiles
      if (files.length === 0 && !isFetchingFiles) {
        setIsFetchingFiles(true)
        const res = await window.koda.getFiles()
        if (res.success) { files = res.files; setAllFiles(files) }
        setIsFetchingFiles(false)
      }
      const filtered = files.filter(f => f.toLowerCase().includes(query)).slice(0, 10)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSuggestionIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }, [input, inputRef, availableSkills, allFiles, isFetchingFiles, setInput])

  const selectSuggestion = useCallback((file: string) => {
    const textBeforeAt = input.slice(0, suggestionTriggerPos)
    const textAfterAt = input.slice(inputRef.current?.selectionStart || 0)
    setInput(`${textBeforeAt}@[${file}] ${textAfterAt.trimStart()}`)
    setShowSuggestions(false)
  }, [input, suggestionTriggerPos, inputRef, setInput])

  const selectSlashItem = useCallback((item: any) => {
    setInput(item.name + ' ')
    setShowSlashMenu(false)
  }, [setInput])

  const pushHistory = useCallback((msg: string) => {
    setHistory(prev => prev[0] === msg ? prev : [msg, ...prev])
    setHistoryIndex(-1)
  }, [])

  return {
    allFiles,
    setAllFiles,
    suggestions,
    showSuggestions,
    suggestionIndex,
    setSuggestionIndex,
    slashItems,
    showSlashMenu,
    slashIndex,
    setSlashIndex,
    history,
    historyIndex,
    setHistoryIndex,
    handleInputChange,
    selectSuggestion,
    selectSlashItem,
    pushHistory,
    setShowSuggestions,
    setShowSlashMenu,
  }
}
