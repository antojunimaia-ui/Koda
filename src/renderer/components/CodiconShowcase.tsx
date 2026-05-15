import React from 'react'
import { Codicon } from './Codicon'

/**
 * Showcase component to test Codicons
 * Add this to your app temporarily to see all icons
 */
export const CodiconShowcase: React.FC = () => {
  const icons = [
    'folder', 'file', 'new-file', 'new-folder',
    'chevron-right', 'chevron-down', 'close', 'search',
    'edit', 'trash', 'refresh', 'settings',
    'terminal', 'globe', 'pin', 'check',
    'error', 'warning', 'info', 'loading',
    'git-commit', 'git-branch', 'github',
    'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
    'save', 'split-horizontal', 'split-vertical',
    'debug', 'run', 'stop', 'play', 'pause',
    'menu', 'more', 'ellipsis', 'home', 'account',
    'bell', 'book', 'bookmark', 'code', 'comment',
    'database', 'heart', 'history', 'key', 'lightbulb',
    'link', 'lock', 'unlock', 'mail', 'markdown',
    'package', 'rocket', 'star', 'tag', 'zoom-in', 'zoom-out'
  ]

  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">Codicons Showcase</h1>
      
      <div className="grid grid-cols-6 gap-4 mb-8">
        {icons.map(icon => (
          <div key={icon} className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
            <Codicon icon={icon} size={24} className="text-cyan-400" />
            <span className="text-xs text-slate-400 text-center">{icon}</span>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-white mb-4">Examples</h2>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
          <Codicon icon="loading" spin size={20} className="text-cyan-400" />
          <span className="text-white">Loading with spin animation</span>
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
          <Codicon icon="check" size={20} className="text-green-400" />
          <Codicon icon="error" size={20} className="text-red-400" />
          <Codicon icon="warning" size={20} className="text-yellow-400" />
          <Codicon icon="info" size={20} className="text-blue-400" />
          <span className="text-white">Status icons with colors</span>
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
          <button className="flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 rounded transition-colors">
            <Codicon icon="terminal" />
            <span className="text-white text-sm">Open Terminal</span>
          </button>
          
          <button className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded transition-colors">
            <Codicon icon="play" />
            <span className="text-white text-sm">Run</span>
          </button>
          
          <button className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 rounded transition-colors">
            <Codicon icon="trash" />
            <span className="text-white text-sm">Delete</span>
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
          <Codicon icon="folder" size={16} className="text-amber-400" />
          <span className="text-slate-300 text-sm">src/</span>
          <Codicon icon="chevron-right" size={12} className="text-slate-500" />
          <Codicon icon="file" size={16} className="text-slate-400" />
          <span className="text-slate-300 text-sm">index.ts</span>
        </div>
      </div>
    </div>
  )
}

export default CodiconShowcase
