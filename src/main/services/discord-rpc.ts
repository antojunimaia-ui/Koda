import { Client as DiscordRPC } from 'discord-rpc'
import path from 'path'

interface DiscordActivity {
  projectName: string
  fileName?: string
  fileType?: string
  startTimestamp?: number
}

export class DiscordRPCManager {
  private client: DiscordRPC | null = null
  // TODO: Criar um Application no Discord Developer Portal (https://discord.com/developers/applications)
  // 1. Criar novo Application
  // 2. Copiar o Application ID
  // 3. Em "Rich Presence" > "Art Assets", fazer upload da logo do Koda como "koda-logo"
  // 4. Fazer upload de ícones para cada tipo de arquivo (typescript, javascript, react, etc)
  private clientId = '1337000000000000000' // SUBSTITUIR pelo Application ID real
  private connected = false
  private currentActivity: DiscordActivity | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private enabled = false

  constructor() {
    // Não conecta automaticamente, espera ser habilitado
  }

  async enable() {
    if (this.enabled) return
    this.enabled = true
    await this.connect()
  }

  disable() {
    this.enabled = false
    this.disconnect()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  private async connect() {
    if (this.connected || !this.enabled) return

    try {
      this.client = new DiscordRPC({ transport: 'ipc' })

      this.client.on('ready', () => {
        console.log('[Discord RPC] Connected to Discord')
        this.connected = true
        
        // Restaurar atividade se houver
        if (this.currentActivity) {
          this.updateActivity(this.currentActivity)
        }
      })

      this.client.on('disconnected', () => {
        console.log('[Discord RPC] Disconnected from Discord')
        this.connected = false
        
        // Tentar reconectar após 15 segundos se ainda estiver habilitado
        if (this.enabled && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null
            this.connect()
          }, 15000)
        }
      })

      await this.client.login({ clientId: this.clientId })
    } catch (error) {
      console.error('[Discord RPC] Failed to connect:', error)
      this.connected = false
      
      // Tentar reconectar após 30 segundos se ainda estiver habilitado
      if (this.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null
          this.connect()
        }, 30000)
      }
    }
  }

  private disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.client && this.connected) {
      try {
        this.client.clearActivity()
        this.client.destroy()
      } catch (error) {
        console.error('[Discord RPC] Error disconnecting:', error)
      }
    }

    this.client = null
    this.connected = false
  }

  async updateActivity(activity: DiscordActivity) {
    this.currentActivity = activity

    if (!this.connected || !this.client || !this.enabled) {
      return
    }

    try {
      const presence: any = {
        details: `Working on ${activity.projectName}`,
        state: activity.fileName ? `Editing ${activity.fileName}` : 'Browsing files',
        startTimestamp: activity.startTimestamp || Date.now(),
        largeImageKey: 'koda-logo', // Você precisa fazer upload no Discord Developer Portal
        largeImageText: 'Koda AI',
        smallImageKey: this.getFileIcon(activity.fileType),
        smallImageText: activity.fileType || 'File',
        instance: false,
      }

      await this.client.setActivity(presence)
    } catch (error) {
      console.error('[Discord RPC] Failed to update activity:', error)
    }
  }

  async clearActivity() {
    this.currentActivity = null

    if (!this.connected || !this.client) {
      return
    }

    try {
      await this.client.clearActivity()
    } catch (error) {
      console.error('[Discord RPC] Failed to clear activity:', error)
    }
  }

  private getFileIcon(fileType?: string): string {
    if (!fileType) return 'file'

    const iconMap: Record<string, string> = {
      'typescript': 'typescript',
      'javascript': 'javascript',
      'tsx': 'react',
      'jsx': 'react',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rust': 'rust',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'markdown': 'markdown',
    }

    return iconMap[fileType.toLowerCase()] || 'file'
  }

  destroy() {
    this.disable()
  }
}
