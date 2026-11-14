import { describe, expect, it } from 'vitest'
import { detectLanguage, highlightCode } from '../syntax.js'

describe('detectLanguage', () => {
  const cases: Array<[string, string]> = [
    ['file.ts', 'typescript'],
    ['file.tsx', 'typescript'],
    ['file.js', 'javascript'],
    ['file.jsx', 'javascript'],
    ['file.py', 'python'],
    ['file.rb', 'ruby'],
    ['file.rs', 'rust'],
    ['file.go', 'go'],
    ['file.java', 'java'],
    ['file.kt', 'kotlin'],
    ['file.cs', 'csharp'],
    ['file.cpp', 'cpp'],
    ['file.h', 'c'],
    ['file.hpp', 'cpp'],
    ['file.css', 'css'],
    ['file.scss', 'scss'],
    ['file.html', 'html'],
    ['file.xml', 'xml'],
    ['file.json', 'json'],
    ['file.yaml', 'yaml'],
    ['file.yml', 'yaml'],
    ['file.toml', 'toml'],
    ['file.md', 'markdown'],
    ['file.sql', 'sql'],
    ['file.sh', 'bash'],
    ['file.bash', 'bash'],
    ['file.zsh', 'bash'],
    ['file.ps1', 'powershell'],
    ['file.vue', 'html'],
    ['file.svelte', 'html'],
  ]

  it.each(cases)('detects %s as %s', (filename, expected) => {
    expect(detectLanguage(filename)).toBe(expected)
  })

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('FILE.TS')).toBe('typescript')
  })

  it('falls back to plaintext for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('plaintext')
    expect(detectLanguage('noextension')).toBe('plaintext')
  })
})

describe('highlightCode', () => {
  it('returns the input unchanged (highlighting handled in the renderer)', () => {
    const code = 'const a = 1;'
    expect(highlightCode(code, 'typescript')).toBe(code)
  })
})
