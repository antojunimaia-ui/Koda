// Roda após a assinatura — remove atributos de quarentena do .app
// Isso evita o erro "app está corrompido" no macOS sem certificado Apple
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function(context) {
  const { appOutDir, packager } = context
  if (packager.platform.name !== 'mac') return

  const appPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`)
  
  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' })
    console.log(`✓ Removed quarantine attributes from ${appPath}`)
  } catch (e) {
    console.warn('Could not remove xattr (non-fatal):', e.message)
  }
}
