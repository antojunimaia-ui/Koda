/**
 * Persistência dos workspaces (Fase 1 do design B).
 *
 * Guarda no localStorage a lista de workspaces conhecidos (id + cwd) para que,
 * ao reiniciar o app, os painéis possam ser restaurados — e deep links
 * `koda://workspace/<id>` continuem resolvendo entre execuções.
 *
 * O id é gerado no main (fonte da verdade); aqui só persistimos a relação
 * id -> cwd. O registro é intencionalmente enxuto: mensagens/sessões continuam
 * vivendo no storage de sessões por projeto.
 */

export interface PersistedWorkspace {
  id: string
  cwd: string
  lastActive: number
}

const REGISTRY_KEY = 'koda_workspaces_registry'
const ACTIVE_KEY = 'koda_workspaces_active'

export function loadWorkspaces(): PersistedWorkspace[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    return raw ? (JSON.parse(raw) as PersistedWorkspace[]) : []
  } catch {
    return []
  }
}

export function saveWorkspaces(list: PersistedWorkspace[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list))
  } catch {
    /* storage cheio/indisponível — não-fatal */
  }
}

export function loadActiveWorkspaceId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw || null
  } catch {
    return null
  }
}

export function saveActiveWorkspaceId(id: string | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* não-fatal */
  }
}
