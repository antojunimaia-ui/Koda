import React, { useState, useEffect } from 'react';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'local' | 'external';
  command?: string;
  args?: string[];
  argsString?: string; // Internal UI helper
  url?: string;
  enabled: boolean;
}

interface MCPSettingsProps {
  onClose: () => void;
  onSave: (configs: MCPServerConfig[]) => void;
}

const MCPSettings: React.FC<MCPSettingsProps> = ({ onClose, onSave }) => {
  const [configs, setConfigs] = useState<MCPServerConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentEdit, setCurrentEdit] = useState<Partial<MCPServerConfig>>({});

  useEffect(() => {
    window.koda.getMcpConfigs().then(setConfigs);
  }, []);

  const handleAddLocal = () => {
    setEditingId('new_local');
    setCurrentEdit({ type: 'local', name: '', command: '', args: [], enabled: true });
  };

  const handleAddExternal = () => {
    setEditingId('new_external');
    setCurrentEdit({ type: 'external', name: '', url: '', enabled: true });
  };

  const handleSaveEdit = () => {
    let newConfigs = [...configs];
    const updated = { ...currentEdit };
    
    // Parse argsString if it exists
    if (updated.argsString !== undefined) {
      const val = updated.argsString;
      const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
      const args = [];
      let m;
      while ((m = regex.exec(val)) !== null) {
        args.push(m[1] || m[2] || m[0]);
      }
      updated.args = args;
      delete updated.argsString;
    }

    if (editingId?.startsWith('new')) {
      newConfigs.push({ ...updated, id: Math.random().toString(36).substr(2, 9) } as MCPServerConfig);
    } else {
      newConfigs = newConfigs.map(c => c.id === editingId ? { ...c, ...updated } as MCPServerConfig : c);
    }
    setConfigs(newConfigs);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setConfigs(configs.filter(c => c.id !== id));
  };

  const handleSaveAll = () => {
    onSave(configs);
    window.koda.saveMcpConfigs(configs);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex w-[850px] h-[600px] bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
        
        {/* Sidebar */}
        <div className="w-1/3 bg-slate-800/30 border-r border-slate-700/50 flex flex-col p-4 gap-2">
          <div className="text-emerald-400 font-bold flex items-center gap-2 mb-6 px-2">
            <span className="text-xl">🔌</span> MCP Management
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {configs.length === 0 && (
              <div className="text-[10px] text-slate-500 italic p-4 text-center">No MCP servers configured.</div>
            )}
            {configs.map(config => (
              <div 
                key={config.id}
                className={`group flex flex-col gap-1 p-3 rounded-lg border transition-all cursor-pointer ${editingId === config.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'}`}
                onClick={() => { setEditingId(config.id); setCurrentEdit(config); }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200">{config.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(config.id); }} className="text-slate-500 hover:text-rose-400 text-xs">✕</button>
                  </div>
                </div>
                <span className="text-[9px] text-slate-500 font-mono truncate">{config.type === 'local' ? config.command : config.url}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/50">
            <button onClick={handleAddLocal} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors">
              + Local MCP
            </button>
            <button onClick={handleAddExternal} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors">
              + External MCP
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
            {editingId ? (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                    {editingId.startsWith('new') ? 'Add MCP Server' : 'Edit MCP Server'}
                  </h3>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Type: {currentEdit.type}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                   <div className="flex flex-col gap-2">
                      <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Display Name</label>
                      <input 
                        type="text" 
                        value={currentEdit.name || ''} 
                        onChange={e => setCurrentEdit({...currentEdit, name: e.target.value})}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-emerald-500 transition-colors text-xs"
                        placeholder="My MCP Server"
                      />
                   </div>

                   {currentEdit.type === 'local' ? (
                     <>
                        <div className="flex flex-col gap-2">
                           <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Command / Executable</label>
                           <input 
                             type="text" 
                             value={currentEdit.command || ''} 
                             onChange={e => setCurrentEdit({...currentEdit, command: e.target.value})}
                             className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-emerald-500 transition-colors font-mono text-xs"
                             placeholder="node, python, npx..."
                           />
                        </div>
                        <div className="flex flex-col gap-2">
                           <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Arguments (Space separated)</label>
                           <input 
                             type="text" 
                             value={currentEdit.argsString !== undefined ? currentEdit.argsString : (currentEdit.args || []).map(a => a.includes(' ') ? `"${a}"` : a).join(' ')} 
                             onChange={e => {
                               setCurrentEdit({...currentEdit, argsString: e.target.value});
                             }}
                             className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-emerald-500 transition-colors font-mono text-xs"
                             placeholder='--stdio "C:\path with spaces\index.js"'
                           />
                        </div>
                     </>
                   ) : (
                     <div className="flex flex-col gap-2">
                        <label className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">SSE Endpoint URL</label>
                        <input 
                          type="text" 
                          value={currentEdit.url || ''} 
                          onChange={e => setCurrentEdit({...currentEdit, url: e.target.value})}
                          className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-emerald-500 transition-colors font-mono text-xs"
                          placeholder="https://mcp-server.com/sse"
                        />
                     </div>
                   )}

                   <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                      <input 
                        type="checkbox" 
                        checked={currentEdit.enabled} 
                        onChange={e => setCurrentEdit({...currentEdit, enabled: e.target.checked})}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <label className="text-xs text-slate-300 font-bold">Enabled</label>
                   </div>
                </div>

                <div className="flex gap-3 justify-end mt-4">
                  <button onClick={() => setEditingId(null)} className="px-5 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button onClick={handleSaveEdit} className="px-8 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20">Apply Changes</button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <span className="text-5xl mb-4">🔌</span>
                <p className="text-slate-400 text-sm font-medium">Select an MCP server from the list to edit its configuration<br/>or add a new one.</p>
              </div>
            )}
          </div>

          <div className="px-8 py-4 bg-slate-800/20 border-t border-slate-700/50 flex justify-end gap-3">
             <button onClick={onClose} className="px-6 py-2 rounded-lg text-xs font-bold border border-slate-700 text-slate-500 hover:bg-slate-800 transition-colors">Close</button>
             <button onClick={handleSaveAll} className="px-10 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/10">Save All & Reload</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPSettings;
