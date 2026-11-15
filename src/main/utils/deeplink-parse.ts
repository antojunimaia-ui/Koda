export interface DeeplinkWorkspace {
  kind: 'workspace'
  id: string
}

export type DeepLink = DeeplinkWorkspace

/** Extrai o id do workspace de `koda://workspace/<id>` (ou `koda://<id>`). */
export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'koda:') return null

  let id = ''
  if (url.hostname === 'workspace') {
    id = url.pathname.replace(/^\//, '').split('/')[0] ?? ''
  } else if (!url.pathname || url.pathname === '/') {
    id = url.hostname
  }
  return id ? { kind: 'workspace', id } : null
}
