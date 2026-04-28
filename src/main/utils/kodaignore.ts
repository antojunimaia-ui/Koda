import { existsSync, readFileSync } from 'fs'
import { resolve, relative, normalize } from 'path'
import { minimatch } from 'minimatch'

const KODAIGNORE_FILE = '.kodaignore'
const BLOCKED_MSG = (path: string) =>
  `🚫 Access denied: "${path}" exists but is restricted by .kodaignore`

let cachedPatterns: string[] | null = null
let cachedCwd: string | null = null

function loadPatterns(cwd: string): string[] {
  if (cachedCwd === cwd && cachedPatterns !== null) return cachedPatterns

  const ignoreFile = resolve(cwd, KODAIGNORE_FILE)
  if (!existsSync(ignoreFile)) {
    cachedCwd = cwd
    cachedPatterns = []
    return []
  }

  const lines = readFileSync(ignoreFile, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  cachedCwd = cwd
  cachedPatterns = lines
  return lines
}

/** Invalida o cache (chamar quando .kodaignore mudar) */
export function invalidateKodaIgnoreCache() {
  cachedPatterns = null
  cachedCwd = null
}

/**
 * Verifica se um path está bloqueado pelo .kodaignore.
 * @returns null se permitido, ou a mensagem de erro se bloqueado
 */
export function checkKodaIgnore(filePath: string, cwd?: string): string | null {
  const root = cwd || process.cwd()
  const patterns = loadPatterns(root)
  if (patterns.length === 0) return null

  const absPath = resolve(root, filePath)
  const relPath = normalize(relative(root, absPath))

  for (const pattern of patterns) {
    // Testa o path relativo completo e só o nome do arquivo/pasta
    const name = relPath.split(/[/\\]/).pop() || relPath
    if (
      minimatch(relPath, pattern, { dot: true, matchBase: true }) ||
      minimatch(relPath.replace(/\\/g, '/'), pattern, { dot: true }) ||
      minimatch(name, pattern, { dot: true, matchBase: true })
    ) {
      return BLOCKED_MSG(relPath)
    }
  }

  return null
}

/**
 * Filtra uma lista de paths, removendo os bloqueados.
 * Retorna { allowed, blocked } para uso em list_dir/file_find.
 */
export function filterKodaIgnore(paths: string[], cwd?: string): { allowed: string[]; blocked: string[] } {
  const root = cwd || process.cwd()
  const patterns = loadPatterns(root)
  if (patterns.length === 0) return { allowed: paths, blocked: [] }

  const allowed: string[] = []
  const blocked: string[] = []

  for (const p of paths) {
    if (checkKodaIgnore(p, root)) {
      blocked.push(p)
    } else {
      allowed.push(p)
    }
  }

  return { allowed, blocked }
}
