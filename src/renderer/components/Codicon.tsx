import React from 'react'

interface CodiconProps {
  icon: string
  className?: string
  spin?: boolean
  disabled?: boolean
  size?: number
  style?: React.CSSProperties
}

/**
 * Codicon component - VS Code icon font
 * 
 * Usage:
 * <Codicon icon="folder" />
 * <Codicon icon="file" className="text-blue-500" />
 * <Codicon icon="loading" spin />
 * <Codicon icon="gear" size={20} />
 * 
 * Available icons: folder, file, chevron-right, chevron-down, close, search,
 * edit, trash, refresh, settings, terminal, globe, pin, check, error, warning,
 * info, git-commit, git-branch, github, arrow-right, arrow-left, new-file,
 * new-folder, save, split-horizontal, split-vertical, and many more...
 * 
 * See codicons.css for full list
 */
export const Codicon: React.FC<CodiconProps> = ({ 
  icon, 
  className = '', 
  spin = false, 
  disabled = false,
  size,
  style = {}
}) => {
  const classes = [
    'codicon',
    `codicon-${icon}`,
    spin && 'codicon-modifier-spin',
    disabled && 'codicon-modifier-disabled',
    className
  ].filter(Boolean).join(' ')

  const finalStyle = size ? { ...style, fontSize: `${size}px` } : style

  return <i className={classes} style={finalStyle} />
}

export default Codicon
