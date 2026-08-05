import { useState, useEffect, useCallback, useRef } from 'react'
import { Workspace, KodaSettings } from '../types/index.js'
import { KoDB } from '../db/kodb.js'

interface UseAgentInitOptions {
  workspaces: Workspace[]
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>
  setActiveId: (id: string) => void
  updateWorkspace: (id: string, updates: Partial<Workspace> | ((prev: Workspace) => Workspace)) => void
  lastLoadedCwdPerWs: React.MutableRefObject<Map<string, string>>
}

export function useAgentInit({
  workspaces,
  setWorkspaces,
  setActiveId,
  updateWorkspace,
  lastLoadedCwdPerWs,
}: UseAgentInitOptions) {
  const [initializing, setInitializing] = useState(true)
  const [availableSkills, setAvailableSkills] = useState<Array<{ name: string; description: string }>>([])
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; downloaded: boolean } | null>(null)
  const [loadedModels, setLoadedModels] = useState<Record<string, string[]>>({})
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({})

  const fetchModelsForProvider = useCallback(async (provId: string, apiKey: string) => {
    setLoadingState(prev => {
      if (prev[provId]) return prev
      ;(async () => {
        try {
          const res = await window.koda.getModels(provId, apiKey)
          if (res.success && res.models) {
            setLoadedModels(prevModels => ({ ...prevModels, [provId]: res.models as string[] }))
          } else {
            console.warn(`[App] Failed to fetch models for ${provId}:`, res.error)
          }
        } catch (err) {
          console.error(`[App] Error fetching models for ${provId}:`, err)
        } finally {
          setLoadingState(prevLoading => ({ ...prevLoading, [provId]: false }))
        }
      })()
      return { ...prev, [provId]: true }
    })
  }, [])

  // Auto-fetch models for all configured providers on boot
  useEffect(() => {
    try {
      const config = KoDB.get('providersConfig')
      Object.entries(config).forEach(([provId, data]: [string, any]) => {
        const noKeyRequired = ['koda-cloud', 'ollama', 'llamacpp'].includes(provId)
        if (noKeyRequired || !!data.apiKey) fetchModelsForProvider(provId, data.apiKey)
      })
    } catch (e) {
      console.error('Error auto-fetching models:', e)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Main agent bootstrap
  useEffect(() => {
    if (!window.koda) return
    if (workspaces.length > 0) return

    const savedKey      = KoDB.get('apiKey')
    const savedProvider = KoDB.get('provider')
    const savedModel    = KoDB.get('model')
    const savedAdvisor  = KoDB.get('advisorModel')

    const initialId = Math.random().toString(36).substring(7)

    window.koda.init(initialId).then(async (res: any) => {
      if (res.success) {
        const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
        const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
        window.koda.updateApprovedCommands({ base, full })

        const makeWs = (info: any): Workspace => ({
          id: initialId,
          name: 'Main Workspace',
          cwd: info.cwd,
          messages: [],
          isProcessing: false,
          agentInfo: info,
          mode: 'fast',
          trackedFiles: [],
          pinnedFiles: [],
          inputFiles: [],
          pendingImages: [],
          taskQueue: [],
          pendingPlan: null,
          pendingQuestions: null,
          pendingShell: null,
          inPlanMode: false,
          terminalOutput: '',
          currentSessionId: null,
        })

        if (savedKey || savedProvider || savedModel) {
          try {
            const setupRes = await window.koda.setup(initialId, {
              apiKey: savedKey || undefined,
              provider: savedProvider || undefined,
              model: savedModel || undefined,
              advisorModel: savedAdvisor || undefined,
            })
            if (setupRes.success) {
              lastLoadedCwdPerWs.current.set(initialId, setupRes.info.cwd)
              setWorkspaces([makeWs(setupRes.info)])
              setActiveId(initialId)
            }
          } catch { /* fall through to default */ }
        } else {
          lastLoadedCwdPerWs.current.set(initialId, res.info.cwd)
          setWorkspaces([makeWs(res.info)])
          setActiveId(initialId)
        }
      }
      setInitializing(false)
    })

    window.koda.listSkills().then((r: any) => {
      if (r.success && r.skills) setAvailableSkills(r.skills)
    })

    if (Notification.permission === 'default') Notification.requestPermission()

    const unsubUpdater = window.koda.onUpdaterEvent?.((event: string, data: any) => {
      if (event === 'update-available') setUpdateInfo({ version: data?.version, downloaded: false })
      if (event === 'update-downloaded') setUpdateInfo(prev => prev ? { ...prev, downloaded: true } : { downloaded: true })
    })
    return () => { unsubUpdater?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh skills when marketplace installs/uninstalls
  useEffect(() => {
    const refresh = () => {
      window.koda.listSkills().then((r: any) => {
        if (r.success && r.skills) setAvailableSkills(r.skills)
      })
    }
    window.addEventListener('koda:skills-changed', refresh)
    return () => window.removeEventListener('koda:skills-changed', refresh)
  }, [])

  return {
    initializing,
    setInitializing,
    availableSkills,
    updateInfo,
    setUpdateInfo,
    loadedModels,
    loadingState,
    fetchModelsForProvider,
  }
}
