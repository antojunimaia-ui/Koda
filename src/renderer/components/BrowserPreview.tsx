import React, { useState, useRef, useEffect } from 'react';

interface BrowserPreviewProps {
  initialUrl?: string;
  onClose: () => void;
}

const BrowserPreview: React.FC<BrowserPreviewProps> = ({ initialUrl = 'http://localhost:5173', onClose }) => {
  const [url, setUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const webviewRef = useRef<any>(null);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = inputUrl;
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'http://' + targetUrl;
    }
    setUrl(targetUrl);
  };

  const reload = () => {
    if (webviewRef.current) webviewRef.current.reload();
  };

  const goBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) webviewRef.current.goBack();
  };

  const goForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) webviewRef.current.goForward();
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStartLoading = () => setIsLoading(true);
    const handleStopLoading = () => {
      setIsLoading(false);
      setInputUrl(webview.getURL());
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-white/5 overflow-hidden">
      {/* Browser Toolbar */}
      <div className="h-10 bg-slate-800/50 border-b border-white/5 flex items-center px-3 gap-3">
        <div className="flex items-center gap-1">
          <button onClick={goBack} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button onClick={goForward} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <button onClick={reload} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center h-7 bg-black/40 border border-white/10 rounded-md px-2 focus-within:border-cyan-500/50 transition-all">
          <div className="text-slate-500 mr-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <input 
            type="text" 
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-slate-300 font-mono"
            placeholder="Search or enter URL..."
          />
          {isLoading && (
            <div className="w-3 h-3 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
          )}
        </form>

        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors" title="Close Preview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Webview Content */}
      <div className="flex-1 bg-white relative">
        <webview 
          ref={webviewRef}
          src={url}
          style={{ width: '100%', height: '100%' }}
          allowpopups={true}
        />
      </div>
    </div>
  );
};

export default BrowserPreview;
