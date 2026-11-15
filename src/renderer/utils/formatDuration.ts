/**
 * Formata uma duração em ms exatamente como o Antigravity ("Worked for 12s").
 * Referência: `xw()` do bundle do Antigravity (s / m / Xh Ym / Xd Yh Zm).
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const remMinutes = minutes % 60

  if (days > 0) return `${days}d ${hours % 24}h ${remMinutes}m`
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`
}
