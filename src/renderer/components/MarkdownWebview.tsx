import React, { useRef, useEffect, useState } from 'react';

interface MarkdownWebviewProps {
  content: string;
  filePath: string;
}

const MarkdownWebview: React.FC<MarkdownWebviewProps> = ({ content, filePath }) => {
  const webviewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      console.log('[MarkdownWebview] DOM Ready');
      // Wait a bit for the webview to fully initialize
      setTimeout(() => {
        setIsReady(true);
      }, 100);
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

  // Send content when webview is ready or content changes
  useEffect(() => {
    if (!isReady || !webviewRef.current || !content) {
      console.log('[MarkdownWebview] Not ready to send:', { isReady, hasWebview: !!webviewRef.current, hasContent: !!content });
      return;
    }

    console.log('[MarkdownWebview] Sending content to webview, length:', content.length);
    
    try {
      // Use executeJavaScript to send message to webview
      const escapedContent = JSON.stringify(content);
      const script = `
        (function() {
          console.log('[Webview Script] Executing, renderMarkdown exists:', typeof window.renderMarkdown);
          if (window.renderMarkdown) {
            window.renderMarkdown(${escapedContent});
            return 'success';
          } else {
            console.error('[Webview Script] renderMarkdown function not found');
            return 'error: renderMarkdown not found';
          }
        })();
      `;
      
      webviewRef.current.executeJavaScript(script)
        .then((result: any) => {
          console.log('[MarkdownWebview] executeJavaScript result:', result);
        })
        .catch((err: Error) => {
          console.error('[MarkdownWebview] Error sending content:', err);
          setError('Failed to render content: ' + err.message);
        });
    } catch (error) {
      console.error('[MarkdownWebview] Error sending content:', error);
      setError('Failed to render content');
    }
  }, [isReady, content]);

  // Get the path to the HTML file
  const htmlPath = window.location.protocol === 'file:' 
    ? `${window.location.origin}/assets/markdown-viewer.html`
    : 'http://localhost:5173/assets/markdown-viewer.html';

  console.log('[MarkdownWebview] Loading webview from:', htmlPath);

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
        partition="persist:markdown"
        webpreferences="contextIsolation=no,nodeIntegration=no"
        style={{ display: 'flex', flex: '1 1 auto', height: '100%', minHeight: 0 }}
      />
    </div>
  );
};

export default MarkdownWebview;
