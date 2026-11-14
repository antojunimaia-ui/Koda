import { vi } from 'vitest'

// O node-pty é um módulo nativo que exige build (não disponível no CI com
// `--ignore-scripts`). Mockamos globalmente nos testes — nenhuma suíte deve
// carregar o binário real.
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}))
