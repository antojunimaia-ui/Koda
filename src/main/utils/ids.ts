import { randomInt } from 'node:crypto'

// Alfabeto base62 (0-9, A-Z, a-z) — sem caracteres ambíguos.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Gera um ID aleatório não-guessável para workspaces (16 chars base62).
 *
 * O main process é a fonte da verdade dos IDs: o renderer pede um ID aqui em
 * vez de gerar localmente com Math.random (que tinha ~7 chars e entropia
 * fraca). É este ID que aparece nos deep links koda://workspace/<id> e, na
 * Fase 2, na URL de cada painel (WebContentsView).
 */
export function generateWorkspaceId(length = 16): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]
  }
  return out
}
