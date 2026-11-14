import { vi } from 'vitest'

// O node-pty é um módulo nativo que exige build (não disponível no CI com
// `--ignore-scripts`). Mockamos globalmente nos testes — nenhuma suíte deve
// carregar o binário real.
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}))

// O pacote electron também depende de postinstall (download do binário) — no CI
// com `--ignore-scripts` ele lança ao ser importado. Fornecemos uma superfície
// mínima para módulos que o importam (agent, shell, providers).
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    whenReady: () => Promise.resolve(),
    commandLine: { appendSwitch: vi.fn() },
  },
  BrowserWindow: {
    getAllWindows: () => [],
    fromWebContents: () => null,
  },
  net: { fetch: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), removeAllListeners: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
}))
