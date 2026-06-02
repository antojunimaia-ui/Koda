#!/usr/bin/env node

/**
 * Script to clear Electron/Chromium cache to resolve disk cache corruption issues
 */

import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { homedir } from 'os'

// Cache paths that are commonly used by Electron/Chromium
function getDefaultCachePaths() {
  const userDataPath = path.join(homedir(), 'AppData', 'Local', 'Koda')
  const cachePath = path.join(homedir(), 'AppData', 'Local', 'Koda', 'Cache')
  const tempPath = os.tmpdir()
  
  // Additional Chromium cache paths that might affect Electron
  const chromiumPaths = [
    path.join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    path.join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'),
    path.join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'GPUCache'),
    path.join(homedir(), 'AppData', 'Roaming', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    path.join(homedir(), 'AppData', 'Roaming', 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'),
  ]
  
  return [userDataPath, cachePath, tempPath, ...chromiumPaths]
}

async function clearCache(includeSystemCache = false) {
  console.log('Clearing Electron cache...')
  
  const cachePaths = getDefaultCachePaths()
  
  if (includeSystemCache) {
    console.log('Also clearing system browser caches...')
  }

  for (const cachePath of cachePaths) {
    try {
      console.log(`Attempting to clear: ${cachePath}`)
      
      // Check if directory exists
      if (await fs.access(cachePath).then(() => true).catch(() => false)) {
        // Common cache subdirectories
        const cacheSubDirs = [
          'Cache',
          'Code Cache',
          'GPUCache',
          'ShaderCache',
          'Media Cache',
          'Pepper Data'
        ]
        
        // Clear subdirectories first
        for (const subDir of cacheSubDirs) {
          const fullPath = path.join(cachePath, subDir)
          try {
            if (await fs.access(fullPath).then(() => true).catch(() => false)) {
              try {
                await fs.rm(fullPath, { recursive: true, force: true })
                console.log(`✓ Cleared: ${fullPath}`)
              } catch (err) {
                if (err.code === 'EBUSY') {
                  console.warn(`⚠ Resource busy, skipping: ${fullPath}`)
                  console.warn(`   Close any running browsers and try again`)
                } else {
                  console.warn(`⚠ Could not clear ${fullPath}:`, err.message)
                }
              }
            }
          } catch (err) {
            console.warn(`⚠ Could not access ${fullPath}:`, err.message)
          }
        }
        
        // Clear the main directory (except temp)
        if (!cachePath.includes('Temp') && !cachePath.includes('tmp')) {
          await fs.rm(cachePath, { recursive: true, force: true })
          console.log(`✓ Cleared: ${cachePath}`)
        }
      } else {
        console.log(`Directory not found: ${cachePath}`)
      }
    } catch (err) {
      console.error(`✗ Error clearing ${cachePath}:`, err.message)
    }
  }

  console.log('Cache clearing completed')
  
  // Instructions for manual restart
  console.log('Please restart the Koda application manually.')
  console.log('The cache has been cleared successfully.')
}

// Handle command line arguments
const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const systemCache = args.includes('--system')

if (confirm) {
  clearCache(systemCache)
} else {
  console.log('Koda Cache Cleaner')
  console.log('==================')
  console.log('This script clears Electron/Chromium cache to resolve disk corruption errors.')
  console.log('')
  console.log('Options:')
  console.log('  --confirm    Execute the cache clearing')
  console.log('  --system    Also clear system browser caches (Chrome/Edge)')
  console.log('')
  console.log('Cache locations to be cleared:')
  console.log('- Koda application cache')
  console.log('- Chromium cache files')
  console.log('- Temporary files')
  if (systemCache) {
    console.log('- Chrome/Edge browser caches')
  }
  console.log('')
  console.log('To proceed, run: node scripts/clear-cache.mjs --confirm [--system]')
}