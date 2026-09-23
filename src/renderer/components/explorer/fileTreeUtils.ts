import { FileNode } from './types.js'

export function buildTree(paths: string[], cwd: string): FileNode[] {
  const root: Record<string, any> = {}
  const normalCwd = cwd.replace(/\\/g, '/')

  for (const p of paths) {
    const normalP = p.replace(/\\/g, '/')
    const rel = normalP.startsWith(normalCwd)
      ? normalP.slice(normalCwd.length).replace(/^\//, '')
      : normalP
    if (!rel) continue
    const parts = rel.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      if (!node[part]) {
        node[part] = {
          __path: normalCwd + '/' + parts.slice(0, i + 1).join('/'),
          __children: {}
        }
      }
      node = node[part].__children
    }
  }

  function toNodes(obj: Record<string, any>): FileNode[] {
    return Object.entries(obj)
      .map(([name, val]) => ({
        name,
        path: val.__path,
        isDir: Object.keys(val.__children).length > 0,
        children: toNodes(val.__children),
      }))
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })
  }

  return toNodes(root)
}

export function updateNodeInTree(nodes: FileNode[], targetPath: string, newChildren: FileNode[]): FileNode[] {
  return nodes.map(node => {
    if (node.path === targetPath) {
      return { ...node, children: newChildren }
    }
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, targetPath, newChildren) }
    }
    return node
  })
}

export function findNodeInTree(nodes: FileNode[], targetPath: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) return node
    if (node.children) {
      const found = findNodeInTree(node.children, targetPath)
      if (found) return found
    }
  }
  return undefined
}

export function isMarkdown(name: string): boolean {
  return name.toLowerCase().endsWith('.md') || name.toLowerCase().endsWith('.mdx')
}
