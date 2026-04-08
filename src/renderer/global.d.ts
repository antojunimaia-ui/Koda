export {}

declare global {
  interface Window {
    marked?: any;
    hljs?: any;
    koda: {
      init: () => Promise<{ success: boolean; error?: string }>
      sendMessage: (messageId: number, message: string) => Promise<{ success: boolean; response: string; error?: string }>
      snapshotRestore: (messageId: number) => Promise<{ success: boolean; error?: string }>
      reset: () => Promise<{ success: boolean; error?: string }>
      getTokens: () => Promise<string>
      getInfo: () => Promise<{ provider: string; model: string; project: string; cwd: string }>
      cd: (path: string) => Promise<{ success: boolean; info?: any; error?: string }>
      setApiKey: (key: string) => Promise<{ success: boolean; info?: any; error?: string }>
      setModel: (model: string) => Promise<{ success: boolean; info?: any; error?: string }>
      getModels: (provider: string, apiKey: string) => Promise<{ success: boolean; models?: string[]; error?: string }>
      setup: (config: { provider?: string, model?: string, apiKey?: string }) => Promise<{ success: boolean; info?: any; error?: string }>
      onUpdate: (callback: (update: any) => void) => void
      removeUpdateListener: () => void
      planResponse: (approved: boolean) => Promise<{ success: boolean }>
      ptySendCtrlC: (pid: number) => Promise<{ success: boolean; error?: string }>
      ptyKill: (pid: number) => Promise<{ success: boolean; error?: string }>
      getFiles: () => Promise<{ success: boolean; files: string[]; error?: string }>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      selectDirectory: () => Promise<string | null>
    }
  }
}
