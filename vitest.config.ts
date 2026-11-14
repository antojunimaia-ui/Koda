import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    // Evita que o cache de módulos do Vitest interfira no typecheck/build
    restoreMocks: true,
    // Os testes de ferramentas usam chdir/arquivos temporários — roda em série por arquivo
    fileParallelism: false,
  },
})
