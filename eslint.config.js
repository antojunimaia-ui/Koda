import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'release-build/**',
      'release/**',
      'src/renderer/themes/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // O TypeScript já verifica nomes indefinidos e variáveis não usadas
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `any` explícito: avisar (permitido, mas sinalizado)
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Hooks: regra de uso obrigatória; exhaustive-deps desligada
      // (base legada com muitos disables; ativar futuramente)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      // Regras legadas que geram ruído sem valor real
      'no-control-regex': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'require-yield': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
  prettier,
)
