import React, { useState } from 'react'
import Editor from '@monaco-editor/react'
import { MessageEntry, AttachedImage, AgentInfo, Mode, KodaTheme, KodaSettings, TrackedFile } from '../types/index.js'
import { FileExplorer } from './context/ContextPanel.js'

interface IDELayoutProps {
  // Explorer props
  showExplorerPanel: boolean
  cwd: string
  pinnedFiles: string[]
  onPin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput: (path: string) => void
  
  // Editor props
  showEditorPanel: boolean
  
  // Chat props (será o conteúdo principal quando não há editor)
  children: React.ReactNode
}

const IDELayout: React.FC<IDELayoutProps> = ({
  showExplorerPanel,
  cwd,
  pinnedFiles,
  onPin,
  onInject,
  onAddToInput,
  showEditorPanel,
  children
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const loadFileContent = async (filePath: string) => {
    setIsLoadingFile(true)
    try {
      const result = await window.koda.readFile(filePath)
      if (result.success) {
        setFileContent(result.content)
        setSelectedFile(filePath)
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Error loading file:', error)
    } finally {
      setIsLoadingFile(false)
    }
  }

  const saveFileContent = async () => {
    if (!selectedFile) return
    try {
      await window.koda.writeFile(selectedFile, fileContent)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const handleFileContentChange = (newContent: string) => {
    setFileContent(newContent)
    setHasUnsavedChanges(true)
  }

  const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'toml': 'toml',
      'ini': 'ini',
      'dockerfile': 'dockerfile',
      'vue': 'vue',
      'svelte': 'svelte',
    }
    return languageMap[ext || ''] || 'plaintext'
  }

  const handleFileClick = (filePath: string) => {
    if (showEditorPanel) {
      loadFileContent(filePath)
    } else {
      onInject(filePath)
    }
  }

  return (
    <div className="flex h-full">
      {/* Explorer Panel */}
      {showExplorerPanel && (
        <div className="w-64 flex-shrink-0 border-r border-white/10 bg-[#0a0a0b]">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-3 border-b border-white/5">
              <h3 className="text-slate-300 text-[11px] font-bold uppercase tracking-wider">Explorer</h3>
            </div>
            <FileExplorer 
              cwd={cwd} 
              onInject={handleFileClick}
              onPin={onPin} 
              onAddToInput={onAddToInput}
              pinnedFiles={pinnedFiles}
              disableInlineEditor={true}
            />
          </div>
        </div>
      )}

      {/* Editor Panel */}
      {showEditorPanel && (
        <div className="flex-1 border-r border-white/10 bg-[#0a0a0b] flex flex-col">
          {selectedFile ? (
            <>
              {/* Editor Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0a0b]">
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 text-[11px] font-medium truncate" title={selectedFile}>
                    {selectedFile.split('/').pop()}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 bg-amber-400 rounded-full" title="Unsaved changes" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && (
                    <button
                      onClick={saveFileContent}
                      className="px-3 py-1.5 text-[10px] bg-indigo-500/20 text-indigo-300 rounded hover:bg-indigo-500/30 transition-colors"
                      title="Save (Ctrl+S)"
                    >
                      Save
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setFileContent('')
                      setHasUnsavedChanges(false)
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Close"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 relative">
                {isLoadingFile ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-slate-600 text-[11px]">Loading...</span>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    language={getLanguageFromFilename(selectedFile)}
                    value={fileContent}
                    onChange={(value) => handleFileContentChange(value || '')}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                      tabSize: 2,
                      insertSpaces: true,
                      formatOnPaste: true,
                      formatOnType: true,
                      renderWhitespace: 'selection',
                      bracketPairColorization: { enabled: true },
                      guides: {
                        bracketPairs: true,
                        indentation: true,
                      },
                    }}
                    beforeMount={(monaco) => {
                      // Disable all validation/diagnostics
                      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true,
                      })
                      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true,
                      })
                      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                        validate: false,
                      })
                      monaco.languages.html.htmlDefaults.setOptions({
                        validate: false,
                      })
                      monaco.languages.css.cssDefaults.setOptions({
                        validate: false,
                      })
                    }}
                    onMount={(editor, monaco) => {
                      // Add Ctrl+S keybinding
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        saveFileContent()
                      })
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" 
                  strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-600">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p className="text-slate-500 text-[12px] mb-1">No file selected</p>
                <p className="text-slate-600 text-[10px]">Click on a file in the explorer to open it</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Panel */}
      <div className={`${showEditorPanel ? 'w-96' : 'flex-1'} flex-shrink-0`}>
        {children}
      </div>
    </div>
  )
}

export default IDELayout