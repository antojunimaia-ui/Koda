/**
 * Argumentos da instância (URL/app) — Fase 2.
 *
 * Cada WebContentsView carrega o mesmo app com parâmetros próprios:
 *   ?mode=panel&ws=<id>&hideTitlebar=1&hideIconbar=1&hideTabs=1
 * Assim o mesmo shell pode esconder chrome (titlebar/sidebar/tabs) por
 * instância, sem mudar a interface — só configuração.
 */

export interface AppArgs {
  mode?: string | null
  ws?: string | null
  window?: string | null
  hideTitlebar: boolean
  hideIconbar: boolean
  hideTabs: boolean
  hideHistory: boolean
}

export function parseAppArgs(search: string): AppArgs {
  const p = new URLSearchParams(search)
  const bool = (key: string) => p.get(key) === '1' || p.get(key) === 'true'
  return {
    mode: p.get('mode'),
    ws: p.get('ws'),
    window: p.get('window'),
    hideTitlebar: bool('hideTitlebar'),
    hideIconbar: bool('hideIconbar'),
    hideTabs: bool('hideTabs'),
    hideHistory: bool('hideHistory'),
  }
}

export function getAppArgs(): AppArgs {
  if (typeof window === 'undefined')
    return { hideTitlebar: false, hideIconbar: false, hideTabs: false, hideHistory: false }
  return parseAppArgs(window.location.search)
}
