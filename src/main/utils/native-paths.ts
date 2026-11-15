import path from 'node:path'

let ensured = false

/**
 * Garante que o resolver do Node encontre módulos nativos que ficam FORA do
 * asar (resources/node_modules), onde o electron-builder os coloca via
 * extraResources (ex.: node-pty).
 *
 * Motivo: dentro de app.asar, caminhos relativos de um módulo JS apontam para
 * o asar virtual; `require('.../build/Release/pty.node')` falha porque o
 * binário foi desempacotado. Ao apontar o resolver para o caminho físico
 * (resources/node_modules), o `__dirname` é real e o binário é encontrado.
 */
export function ensureNativePaths(): void {
  if (ensured) return
  ensured = true

  // Em dev (Vite) não há resourcesPath — o node_modules comum resolve.
  const resourcesPath = process.resourcesPath
  if (!resourcesPath) return

  const target = path.join(resourcesPath, 'node_modules')
  if (!module.paths.includes(target)) {
    module.paths.push(target)
  }

  const sep = process.platform === 'win32' ? ';' : ':'
  const current = process.env.NODE_PATH || ''
  if (!current.split(sep).includes(target)) {
    process.env.NODE_PATH = current ? `${current}${sep}${target}` : target
    try {
      require('module').Module._initPaths?.()
    } catch {
      /* best-effort */
    }
  }
}
