import { ipcMain } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { net } from 'electron'
import { Agent } from '../core/agent.js'

const MARKETPLACE_INDEX_URL = 'https://raw.githubusercontent.com/antojunimaia-ui/koda-skills/main/index.json'
const MARKETPLACE_RAW_BASE  = 'https://raw.githubusercontent.com/antojunimaia-ui/koda-skills/main/skills'

const efetch: typeof fetch = (input: any, init?: any) => net.fetch(input, init) as any

export function registerSkillsHandlers(agents: Map<string, Agent>) {
  ipcMain.handle('skills:list', async () => {
    try {
      const { skillManager } = await import('../services/skill-manager.js')
      const skills = await skillManager.getAll()
      return {
        success: true,
        skills: skills.map(s => ({ name: s.name, description: s.description, triggers: s.triggers, filePath: s.filePath })),
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('marketplace:fetch', async () => {
    try {
      const res = await efetch(MARKETPLACE_INDEX_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const skills = await res.json()
      return { success: true, skills }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('marketplace:install', async (_event, skillName: string, version?: string) => {
    try {
      const mdRes = await efetch(`${MARKETPLACE_RAW_BASE}/${skillName}/skill.md`)
      if (!mdRes.ok) throw new Error(`skill.md not found for "${skillName}"`)
      let mdContent = await mdRes.text()

      if (version && mdContent.startsWith('---')) {
        mdContent = mdContent.replace(/^---\r?\n/, `---\nversion: ${version}\n`)
      }

      const skillsDir = path.join(os.homedir(), '.koda', 'skills')
      await fs.mkdir(skillsDir, { recursive: true })
      await fs.writeFile(path.join(skillsDir, `${skillName}.md`), mdContent, 'utf-8')

      const { skillManager } = await import('../services/skill-manager.js')
      skillManager.invalidate()
      for (const a of agents.values()) await a.reloadMcpTools()

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('marketplace:uninstall', async (_event, skillName: string) => {
    try {
      const globalPath = path.join(os.homedir(), '.koda', 'skills', `${skillName}.md`)
      const localPath  = path.join(process.cwd(), '.koda', 'skills', `${skillName}.md`)

      let removed = false
      for (const p of [globalPath, localPath]) {
        try { await fs.unlink(p); removed = true } catch { /* not there */ }
      }
      if (!removed) throw new Error(`Skill "${skillName}" not found on disk`)

      const { skillManager } = await import('../services/skill-manager.js')
      skillManager.invalidate()

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
