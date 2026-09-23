import { useState, useRef, useCallback, useEffect } from 'react'
import { SlashItem } from '../types/index.js'

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

  // Native commands fetched once from main process — always up to date
  const [nativeCommands, setNativeCommands] = useState<Array<{ name: string; description: string; icon: string }>>([])

  useEffect(() => {
    window.koda.getSlashCommands().then((res: any) => {
      if (res?.success) setNativeCommands(res.commands)
    }).catch(() => {/* non-fatal */})
  }, [])

  const handleInputChange = useCallback(async (val: string) => {
    setInput(val)
    const cursor = inputRef.current?.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)

    // Slash command menu
    const slashMatch = val.match(/^\/(\S*)/)
    if (slashMatch) {
      const query = slashMatch[1].toLowerCase()
      const nativeItems: SlashItem[] = nativeCommands.map(c => ({
        name: `/${c.name}`,
        description: c.description,
        icon: c.icon,
      }))
      const skillItems: SlashItem[] = availableSkills.map(s => ({
        name: `/${s.name}`,
        description: s.description,
        icon: '🎯',
        isSkill: true as const,
      }))
      const allItems = [...nativeItems, ...skillItems]
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
  }, [input, inputRef, availableSkills, nativeCommands, allFiles, isFetchingFiles, setInput])

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
