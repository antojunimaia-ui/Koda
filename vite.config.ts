import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// Exclude all dependencies from the Electron main process bundle
// to prevent Vite from taking 4 minutes trying to package massive AI SDKs
const external = Object.keys(pkg.dependencies || {})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [...external, 'node-pty', 'operantid.js']
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: [...external]
            }
          },
        },
      },
      renderer: {},
    }),
  ],
})
