import React, { useRef, useEffect, useState } from 'react';

interface MarkdownWebviewProps {
  content: string;
  filePath: string;
}

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * Pre-processes markdown content, replacing relative image paths with
 * base64 data: URLs fetched via IPC. This bypasses all Same-Origin
 * and file:// restrictions in the webview.
 */
async function resolveImages(content: string, baseDir: string): Promise<string> {
  const matches = [...content.matchAll(IMAGE_REGEX)];
  let resolved = content;

  for (const match of matches) {
    const [full, alt, href] = match;
    // Skip already-absolute URLs and data: URIs
    if (href.startsWith('http') || href.startsWith('data:') || href.startsWith('file:')) continue;

    // Build absolute path
    const cleanHref = href.startsWith('./') ? href.slice(2) : href.startsWith('/') ? href.slice(1) : href;
    const absPath = `${baseDir}/${cleanHref}`.replace(/\//g, '\\');

    try {
      const result = await (window.koda as any).readFileBase64(absPath);
      if (result?.success && result.dataUrl) {
        resolved = resolved.replace(full, `![${alt}](${result.dataUrl})`);
      }
    } catch {
      // If the image can't be loaded, leave it as-is
    }
  }

  return resolved;
}

const MarkdownWebview: React.FC<MarkdownWebviewProps> = ({ content, filePath }) => {
  const webviewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      setTimeout(() => setIsReady(true), 100);
    };
    const handleDidFailLoad = (event: any) => {
      console.error('[MarkdownWebview] Failed to load:', event);
      setError('Failed to load markdown preview');
    };
    const handleConsoleMessage = (event: any) => {
      console.log('[MarkdownWebview Console]', event.message);
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('console-message', handleConsoleMessage);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('console-message', handleConsoleMessage);
    };
  }, []);

  // Send content when webview is ready or content/filePath changes
  useEffect(() => {
    if (!isReady || !webviewRef.current || !content) return;

    const baseDir = filePath.replace(/\\/g, '/').substring(0, filePath.replace(/\\/g, '/').lastIndexOf('/'));

    resolveImages(content, baseDir).then((processedContent) => {
      const escapedContent = JSON.stringify(processedContent);
      const script = `
        (function() {
          if (window.renderMarkdown) {
            window.renderMarkdown(${escapedContent});
            return 'success';
          }
          return 'error: renderMarkdown not found';
        })();
      `;

      webviewRef.current?.executeJavaScript(script)
        .then((result: any) => console.log('[MarkdownWebview] result:', result))
        .catch((err: Error) => setError('Failed to render content: ' + err.message));
    });
  }, [isReady, content, filePath]);

  const htmlPath = window.location.protocol === 'file:'
    ? `${window.location.origin}/assets/markdown-viewer.html`
    : 'http://localhost:5173/assets/markdown-viewer.html';

  // Each file gets its own isolated partition so scroll/state doesn't bleed between tabs
  const partition = `persist:md-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <div className="h-full w-full bg-[#141414] relative flex flex-col">
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/10 border-b border-red-500/30 text-red-400 px-4 py-2 text-xs z-10">
          {error}
        </div>
      )}
      <webview
        ref={webviewRef}
        src={htmlPath}
        className="w-full h-full flex-1"
        partition={partition}
        webpreferences="contextIsolation=no,nodeIntegration=no"
        style={{ display: 'flex', flex: '1 1 auto', height: '100%', minHeight: 0 }}
      />
    </div>
  );
};

export default MarkdownWebview;
