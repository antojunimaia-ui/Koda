/**
 * Namespacing para chaves de localStorage por workspace.
 *
 * Fase 0 do design B (isolamento real de splits): estabelece o contrato de
 * chaves escopadas por workspace id. Na Fase 2, os painéis migram para
 * WebContentsView com partition própria — estas chaves já nascem isoladas.
 * Chaves globais por design (tema, providers, approves, tour) continuam fora
 * deste prefixo.
 */
export function wsStorageKey(workspaceId: string, key: string): string {
  return `koda_ws:${workspaceId}:${key}`
}
