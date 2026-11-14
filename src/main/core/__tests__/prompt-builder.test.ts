import { describe, expect, it } from 'vitest'
import { PromptBuilder } from '../prompt-builder.js'

const BASE = 'You are Koda, an AI coding agent.'

describe('PromptBuilder.buildEnvContext', () => {
  it('includes cwd, platform, os and shell', () => {
    const block = PromptBuilder.buildEnvContext({
      cwd: '/repo',
      osRelease: '10.0.0',
      platform: 'linux',
      shell: 'bash',
    })
    expect(block).toContain('/repo')
    expect(block).toContain('linux')
    expect(block).toContain('bash')
  })

  it('adds a forward-slash note on Windows', () => {
    const block = PromptBuilder.buildEnvContext({
      cwd: 'C:\\repo',
      osRelease: '10.0.0',
      platform: 'win32',
      shell: 'cmd.exe',
    })
    expect(block).toContain('Forward-Slash')
  })
})

describe('PromptBuilder.build', () => {
  it('includes base prompt and environment blocks', () => {
    const prompt = PromptBuilder.build(BASE, { cwd: '/x', platform: 'linux', shell: 'sh' })
    expect(prompt).toContain(BASE)
    expect(prompt).toContain('# ENVIRONMENT CONTEXT')
    expect(prompt).toContain('# OPERATIONAL RULES')
  })

  it('injects tools metadata, project info and rules when provided', () => {
    const prompt = PromptBuilder.build(BASE, {
      cwd: '/x',
      platform: 'linux',
      shell: 'sh',
      toolsMetadata: 'file_read, file_write, file_edit',
      projectSummary: 'React app',
      projectRules: 'Never touch .env',
      additionalDirectives: 'Be concise.',
    })
    expect(prompt).toContain('# AVAILABLE TOOLS')
    expect(prompt).toContain('file_read, file_write, file_edit')
    expect(prompt).toContain('# PROJECT ARCHITECTURE')
    expect(prompt).toContain('React app')
    expect(prompt).toContain('# PROJECT RULES')
    expect(prompt).toContain('Never touch .env')
    expect(prompt).toContain('Be concise.')
  })

  it('joins blocks with a separator', () => {
    const prompt = PromptBuilder.build(BASE, { cwd: '/x', platform: 'linux', shell: 'sh' })
    expect(prompt).toContain('---')
  })
})
