import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

/**
 * On Linux, when the app is running from an AppImage for the first time,
 * automatically installs itself:
 *  - Makes the AppImage executable (chmod +x)
 *  - Copies it to ~/.local/bin/koda.AppImage
 *  - Creates a .desktop entry so it appears in the app menu
 *  - Marks installation as done so it only runs once
 */
export function selfInstallOnLinux(): void {
  if (process.platform !== 'linux') return

  // Only run in packaged AppImage context
  const appImagePath = process.env.APPIMAGE
  if (!appImagePath) return

  const markerPath = path.join(os.homedir(), '.local', 'share', 'koda', '.installed')
  if (fs.existsSync(markerPath)) return

  try {
    const installDir  = path.join(os.homedir(), '.local', 'bin')
    const desktopDir  = path.join(os.homedir(), '.local', 'share', 'applications')
    const iconDir     = path.join(os.homedir(), '.local', 'share', 'icons', 'hicolor', '256x256', 'apps')
    const markerDir   = path.join(os.homedir(), '.local', 'share', 'koda')
    const destAppImage = path.join(installDir, 'koda.AppImage')

    // Create required directories
    for (const dir of [installDir, desktopDir, iconDir, markerDir]) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Copy AppImage to ~/.local/bin if not already there
    if (appImagePath !== destAppImage) {
      fs.copyFileSync(appImagePath, destAppImage)
    }

    // Ensure it's executable
    fs.chmodSync(destAppImage, 0o755)

    // Copy icon from app resources
    // process.resourcesPath points to the correct resources dir inside the AppImage mount
    const iconSrc = path.join(process.resourcesPath, 'icon.png')
    const iconDest = path.join(iconDir, 'koda.png')
    if (fs.existsSync(iconSrc)) {
      fs.copyFileSync(iconSrc, iconDest)
    }

    // Create .desktop entry
    const desktopEntry = [
      '[Desktop Entry]',
      'Name=Koda AI',
      'Comment=Autonomous AI Engineering Agent',
      `Exec=${destAppImage} --no-sandbox`,
      `Icon=${iconDest}`,
      'Terminal=false',
      'Type=Application',
      'Categories=Development;IDE;',
      'StartupWMClass=koda',
    ].join('\n')

    const desktopPath = path.join(desktopDir, 'koda.desktop')
    fs.writeFileSync(desktopPath, desktopEntry, 'utf-8')
    fs.chmodSync(desktopPath, 0o755)

    // Refresh desktop database (best-effort)
    try { execSync(`update-desktop-database "${desktopDir}"`, { stdio: 'ignore' }) } catch {}
    try { execSync('xdg-icon-resource forceupdate', { stdio: 'ignore' }) } catch {}

    // Write marker so we don't repeat this on next launch
    fs.writeFileSync(markerPath, new Date().toISOString(), 'utf-8')

    console.log('[Koda] Self-installed to', destAppImage)
  } catch (err) {
    // Non-fatal — app still works even if install fails
    console.warn('[Koda] Self-install failed (non-fatal):', err)
  }
}
