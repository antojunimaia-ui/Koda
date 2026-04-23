export {}

declare global {
  interface Window {
    marked?: any;
    hljs?: any;
    koda: {
      init: (workspaceId: string) => Promise<{ success: boolean; info: { providerId?: string; provider: string; model: string; advisorModel: string; project: string; cwd: string }; error?: string }>
      sendMessage: (workspaceId: string, messageId: number, message: string, images?: any[]) => Promise<{ success: boolean; response: string; error?: string }>
      snapshotRestore: (workspaceId: string, messageId: number) => Promise<{ success: boolean; error?: string }>
      reset: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
      softReset: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
      getTokens: (workspaceId: string) => Promise<string>
      getInfo: (workspaceId: string) => Promise<{ providerId?: string; provider: string; model: string; advisorModel: string; project: string; cwd: string }>
      cd: (workspaceId: string, path: string) => Promise<{ success: boolean; info?: any; error?: string }>
      setApiKey: (workspaceId: string, key: string) => Promise<{ success: boolean; info?: any; error?: string }>
      setModel: (workspaceId: string, model: string) => Promise<{ success: boolean; info?: any; error?: string }>
      getModels: (workspaceId: string, provider: string, apiKey: string) => Promise<{ success: boolean; models?: string[]; error?: string }>
      setup: (workspaceId: string, config: { provider?: string, model?: string, advisorModel?: string, apiKey?: string }) => Promise<{ success: boolean; info?: any; error?: string }>
      openFile: (workspaceId: string, filePath: string, line?: number) => Promise<{ success: boolean; error?: string }>
      onUpdate: (callback: (update: any) => void) => (() => void)
      removeUpdateListener: () => void
      planResponse: (approved: boolean) => Promise<{ success: boolean }>
      shellResponse: (approved: boolean, alwaysAllowBase: boolean, alwaysAllowFull: boolean) => Promise<{ success: boolean }>
      getApprovedCommands: () => Promise<{ base: string[], full: string[] }>
      updateApprovedCommands: (lists: { base?: string[], full?: string[] }) => Promise<{ success: boolean }>
      ptySendCtrlC: (pid: number) => Promise<{ success: boolean; error?: string }>
      ptyKill: (pid: number) => Promise<{ success: boolean; error?: string }>
      ptyStart: (workspaceId?: string, cwd?: string) => Promise<{ success: boolean; pid: number }>
      ptyWrite: (pid: number, data: string) => Promise<{ success: boolean }>
      ptyResize: (pid: number, cols: number, rows: number) => Promise<{ success: boolean }>
      getFiles: () => Promise<{ success: boolean; files: string[]; error?: string }>
      getMcpConfigs: () => Promise<any[]>
      saveMcpConfigs: (configs: any[]) => Promise<{ success: boolean; error?: string }>
      getProjectSession: (projectPath: string) => Promise<any>
      saveProjectSession: (workspaceId: string, projectPath: string, data: any) => Promise<void>
      listSkills: () => Promise<{ success: boolean; skills?: Array<{ name: string; description: string; triggers: string[]; filePath: string }>; error?: string }>
      marketplaceFetch: () => Promise<{ success: boolean; skills: any[]; error?: string }>
      marketplaceInstall: (skillName: string, version?: string) => Promise<{ success: boolean; error?: string }>
      marketplaceUninstall: (skillName: string) => Promise<{ success: boolean; error?: string }>
      webhookStart: (config: { port: number; token: string }) => Promise<{ success: boolean; error?: string }>
      webhookStop: () => Promise<{ success: boolean }>
      webhookStatus: () => Promise<{ running: boolean; port: number | null }>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      selectDirectory: () => Promise<string | null>
    }
  }
}

declare module 'ansi-to-html';
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.less';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
