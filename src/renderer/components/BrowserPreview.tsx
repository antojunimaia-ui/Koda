import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, X, Lock, Globe, Loader2 } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-[#141414] border-r border-white/5 overflow-hidden">
      {/* Modern Browser Toolbar (Thinner) */}
      <div className="relative h-9 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/40 flex items-center px-3 gap-3 justify-between select-none">
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={goBack} 
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded active:scale-95 transition-all duration-200"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={goForward} 
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded active:scale-95 transition-all duration-200"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={reload} 
            className={`p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded active:scale-95 transition-all duration-200 ${isLoading ? 'animate-spin' : ''}`}
            title="Reload"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Address Bar */}
        <form 
          onSubmit={handleNavigate} 
          className="flex-1 max-w-2xl flex items-center h-6 bg-zinc-900/60 hover:bg-zinc-900/80 focus-within:bg-zinc-950/90 border border-zinc-800/80 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/10 rounded px-2.5 gap-1.5 transition-all duration-200"
        >
          <div 
            className="text-zinc-500 flex items-center" 
            title={inputUrl.startsWith('https') ? "Secure connection" : "Connection not secure"}
          >
            {inputUrl.startsWith('https') ? (
              <Lock className="w-3 h-3 text-emerald-500" />
            ) : (
              <Globe className="w-3 h-3" />
            )}
          </div>
          <input 
            type="text" 
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-zinc-200 font-sans placeholder-zinc-500 leading-none"
            placeholder="Search or enter URL..."
          />
          {isLoading && (
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
          )}
        </form>

        {/* Action Controls */}
        <div className="flex items-center shrink-0">
          <button 
            onClick={onClose} 
            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded active:scale-95 transition-all duration-200" 
            title="Close Preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Linear Loading Progress Bar */}
        {isLoading && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500 bg-[length:200%_auto] animate-[shimmer_1.5s_infinite_linear]" style={{
            backgroundImage: 'linear-gradient(90deg, #06b6d4 0%, #6366f1 50%, #06b6d4 100%)'
          }} />
        )}
      </div>

      {/* Webview Content */}
      <div className="flex-1 bg-zinc-950 relative">
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

