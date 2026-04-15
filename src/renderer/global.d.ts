export {}

declare global {
  interface Window {
    marked?: any;
    hljs?: any;
    koda: {
      init: () => Promise<{ success: boolean; error?: string }>
      sendMessage: (messageId: number, message: string, images?: any[]) => Promise<{ success: boolean; response: string; error?: string }>
      snapshotRestore: (messageId: number) => Promise<{ success: boolean; error?: string }>
      reset: () => Promise<{ success: boolean; error?: string }>
      softReset: () => Promise<{ success: boolean; error?: string }>
      getTokens: () => Promise<string>
      getInfo: () => Promise<{ provider: string; model: string; project: string; cwd: string }>
      cd: (path: string) => Promise<{ success: boolean; info?: any; error?: string }>
      setApiKey: (key: string) => Promise<{ success: boolean; info?: any; error?: string }>
      setModel: (model: string) => Promise<{ success: boolean; info?: any; error?: string }>
      getModels: (provider: string, apiKey: string) => Promise<{ success: boolean; models?: string[]; error?: string }>
      setup: (config: { provider?: string, model?: string, advisorModel?: string, apiKey?: string }) => Promise<{ success: boolean; info?: any; error?: string }>
      openFile: (filePath: string, line?: number) => Promise<{ success: boolean; error?: string }>
      onUpdate: (callback: (update: any) => void) => (() => void)
      removeUpdateListener: () => void
      planResponse: (approved: boolean) => Promise<{ success: boolean }>
      shellResponse: (approved: boolean, alwaysAllowBase: boolean, alwaysAllowFull: boolean) => Promise<{ success: boolean }>
      getApprovedCommands: () => Promise<{ base: string[], full: string[] }>
      updateApprovedCommands: (lists: { base?: string[], full?: string[] }) => Promise<{ success: boolean }>
      ptySendCtrlC: (pid: number) => Promise<{ success: boolean; error?: string }>
      ptyKill: (pid: number) => Promise<{ success: boolean; error?: string }>
      ptyStart: (cwd?: string) => Promise<{ success: boolean; pid: number }>
      ptyWrite: (pid: number, data: string) => Promise<{ success: boolean }>
      ptyResize: (pid: number, cols: number, rows: number) => Promise<{ success: boolean }>
      getFiles: () => Promise<{ success: boolean; files: string[]; error?: string }>
      getMcpConfigs: () => Promise<any[]>
      saveMcpConfigs: (configs: any[]) => Promise<{ success: boolean; error?: string }>
      getProjectSession: (projectPath: string) => Promise<any>
      saveProjectSession: (projectPath: string, data: any) => Promise<void>
      listSkills: () => Promise<{ success: boolean; skills?: Array<{ name: string; description: string; triggers: string[] }>; error?: string }>
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
