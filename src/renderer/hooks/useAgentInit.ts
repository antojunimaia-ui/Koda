import { useState, useEffect, useCallback, useRef } from 'react'
import { Workspace, KodaSettings } from '../types/index.js'
import { KoDB } from '../db/kodb.js'
import { loadWorkspaces, loadActiveWorkspaceId } from '../utils/workspace-persistence.js'
import { NO_KEY_PROVIDERS } from '../../shared/configDefaults.js'

interface UseAgentInitOptions {
  workspaces: Workspace[]
  setWorkspaces: (workspaces: Workspace[] | ((prev: Workspace[]) => Workspace[])) => void
  setActiveId: (id: string) => void
  updateWorkspace: (id: string, updates: Partial<Workspace> | ((prev: Workspace) => Workspace)) => void
  lastLoadedCwdPerWs: React.MutableRefObject<Map<string, string>>
  /** Quando presente (modo painel), ignora o registro salvos e carrega só este workspace. */
  forceWorkspaceId?: string | null
}

export function useAgentInit({
  workspaces,
  setWorkspaces,
  setActiveId,
  updateWorkspace,
  lastLoadedCwdPerWs,
  forceWorkspaceId,
}: UseAgentInitOptions) {
  const [initializing, setInitializing] = useState(true)
  const [availableSkills, setAvailableSkills] = useState<Array<{ name: string; description: string }>>([])
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; downloaded: boolean } | null>(null)
  const [loadedModels, setLoadedModels] = useState<Record<string, string[]>>({})
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({})

  const fetchModelsForProvider = useCallback(async (provId: string, apiKey: string) => {
    setLoadingState((prev) => {
      if (prev[provId]) return prev
      ;(async () => {
        try {
          const res = await window.koda.getModels(provId, apiKey)
          if (res.success && res.models) {
            setLoadedModels((prevModels) => ({ ...prevModels, [provId]: res.models as string[] }))
          } else {
            // Situação esperada (provider sem chave/rede indisponível) — não polui o console
            console.debug(`[App] Failed to fetch models for ${provId}:`, res.error)
          }
        } catch (err) {
          console.debug(`[App] Error fetching models for ${provId}:`, err)
        } finally {
          setLoadingState((prevLoading) => ({ ...prevLoading, [provId]: false }))
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
        const noKeyRequired = NO_KEY_PROVIDERS.includes(provId as (typeof NO_KEY_PROVIDERS)[number])
        if (noKeyRequired || !!data.apiKey) fetchModelsForProvider(provId, data.apiKey)
      })
    } catch (e) {
      console.error('Error auto-fetching models:', e)
    }
  }, [])

  // Main agent bootstrap
  useEffect(() => {
    if (!window.koda) return
    if (workspaces.length > 0) return

    const makeWs = (id: string, info: any): Workspace => ({
      id,
      name: info.project || 'Workspace',
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

    // ── Modo painel: carrega só o workspace forçado (URL do deep link) ───────
    if (forceWorkspaceId) {
      ;(async () => {
        const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
        const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
        window.koda.updateApprovedCommands({ base, full })

        try {
          const res: any = await window.koda.init(forceWorkspaceId)
          if (res.success) {
            const info = res.info
            lastLoadedCwdPerWs.current.set(forceWorkspaceId, info.cwd)
            setWorkspaces([makeWs(forceWorkspaceId, info)])
            setActiveId(forceWorkspaceId)
          }
        } catch {
          /* mantém vazio — o shell renderiza o estado de carregamento */
        }
        setInitializing(false)
      })()
      return
    }

    // ── Restaura workspaces persistidos (Fase 1) ────────────────────────────
    const saved = loadWorkspaces()
    if (saved.length > 0) {
      ;(async () => {
        const restored: Workspace[] = []
        const sorted = [...saved].sort((a, b) => b.lastActive - a.lastActive)
        for (const entry of sorted) {
          try {
            const res: any = await window.koda.init(entry.id)
            if (!res?.success) continue
            let info = res.info
            if (entry.cwd) {
              const cdRes: any = await window.koda.cd(entry.id, entry.cwd).catch(() => null)
              if (cdRes?.success && cdRes.info) info = cdRes.info
            }
            lastLoadedCwdPerWs.current.set(entry.id, info.cwd)
            restored.push(makeWs(entry.id, info))
          } catch {
            /* workspace que falhou ao restaurar — ignora */
          }
        }
        if (restored.length > 0) {
          setWorkspaces(restored)
          const active = loadActiveWorkspaceId()
          setActiveId(restored.some((w) => w.id === active) ? active! : restored[0].id)
        }
        setInitializing(false)
      })()
      return
    }

    // ── Sem workspaces salvos — cria o workspace principal ──────────────────
    ;(async () => {
      const initialId = await window.koda.generateWorkspaceId()
      const base = JSON.parse(localStorage.getItem('koda_approved_base') || '[]')
      const full = JSON.parse(localStorage.getItem('koda_approved_full') || '[]')
      window.koda.updateApprovedCommands({ base, full })

      const savedKey = KoDB.get('apiKey')
      const savedProvider = KoDB.get('provider')
      const savedModel = KoDB.get('model')
      const savedAdvisor = KoDB.get('advisorModel')
      const savedKodaCloudUrl = KoDB.get('kodaCloudBaseUrl')

      const res: any = await window.koda.init(initialId)
      if (res.success) {
        if (savedKey || savedProvider || savedModel || savedKodaCloudUrl) {
          try {
            const setupRes = await window.koda.setup(initialId, {
              apiKey: savedKey || undefined,
              provider: savedProvider || undefined,
              model: savedModel || undefined,
              advisorModel: savedAdvisor || undefined,
              kodaCloudBaseUrl: savedKodaCloudUrl || undefined,
            })
            if (setupRes.success && setupRes.info) {
              lastLoadedCwdPerWs.current.set(initialId, setupRes.info.cwd)
              setWorkspaces([makeWs(initialId, setupRes.info)])
              setActiveId(initialId)
            }
          } catch {
            /* fall through to default */
          }
        } else {
          lastLoadedCwdPerWs.current.set(initialId, res.info.cwd)
          setWorkspaces([makeWs(initialId, res.info)])
          setActiveId(initialId)
        }
      }
      setInitializing(false)
    })()

    window.koda.listSkills().then((r: any) => {
      if (r.success && r.skills) setAvailableSkills(r.skills)
    })

    if (Notification.permission === 'default') Notification.requestPermission()

    const unsubUpdater = window.koda.onUpdaterEvent?.((event: string, data: any) => {
      if (event === 'update-available') setUpdateInfo({ version: data?.version, downloaded: false })
      if (event === 'update-downloaded')
        setUpdateInfo((prev) => (prev ? { ...prev, downloaded: true } : { downloaded: true }))
    })
    return () => {
      unsubUpdater?.()
    }
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
