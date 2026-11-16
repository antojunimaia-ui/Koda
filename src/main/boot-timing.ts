/**
 * Marcadores de tempo do boot do processo principal.
 *
 * Logam quanto tempo passou desde o início do processo (inclui carregamento do
 * Electron e do bundle do main), o que permite comparar antes/depois de mudanças
 * de performance. Silencie com `KODA_BOOT_TIMING=0`.
 */
export function bootMark(label: string): void {
  if (process.env.KODA_BOOT_TIMING === '0') return
  const ms = Math.round(process.uptime() * 1000)
  console.log(`[boot] ${label}: ${ms}ms`)
}
