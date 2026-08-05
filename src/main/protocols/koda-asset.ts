import { protocol, net } from 'electron'

/**
 * Registers the koda-asset:// custom protocol.
 *
 * Must be called BEFORE app is ready via:
 *   protocol.registerSchemesAsPrivileged([...])
 *
 * Used by the Markdown Preview webview to serve local files
 * (images, videos, etc.) without exposing the raw file:// path.
 *
 * URL format: koda-asset://local/<absolute-file-path>
 * Example:    koda-asset://local/C:/Users/foo/project/image.png
 */
export function registerSchemesAsPrivileged() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'koda-asset',
      privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true },
    },
  ])
}

export function registerKodaAssetProtocol() {
  protocol.handle('koda-asset', async (request) => {
    try {
      const url = new URL(request.url)
      // pathname: /C:/path/to/file  — strip the leading slash on Windows
      let filePath = decodeURIComponent(url.pathname)
      if (filePath.match(/^\/[A-Za-z]:\//)) filePath = filePath.slice(1)
      return net.fetch(`file:///${filePath.replace(/\\/g, '/')}`)
    } catch (err) {
      console.error('[koda-asset] Protocol error:', err)
      return new Response('Not found', { status: 404 })
    }
  })
}
