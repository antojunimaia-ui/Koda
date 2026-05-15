import React, { useEffect, useRef } from 'react'
import { Codicon } from './Codicon'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  keybinding?: string
  disabled?: boolean
  separator?: boolean
  submenu?: ContextMenuItem[]
  onClick?: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number }
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Small delay to prevent immediate close from the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y

      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8
      }

      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8
      }

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [position])

  const renderItem = (item: ContextMenuItem) => {
    if (item.separator) {
      return (
        <div
          key={item.id}
          className="h-[1px] bg-white/10 my-0.5 mx-1.5"
          role="separator"
        />
      )
    }

    return (
      <div
        key={item.id}
        className={`
          flex items-center h-6 mx-1 px-2 rounded
          transition-colors cursor-pointer
          ${item.disabled 
            ? 'opacity-40 cursor-default' 
            : 'hover:bg-indigo-500/20 active:bg-indigo-500/30'
          }
        `}
        onClick={() => {
          if (!item.disabled && item.onClick) {
            item.onClick()
            onClose()
          }
        }}
        role="menuitem"
        aria-disabled={item.disabled}
      >
        {/* Icon */}
        <div className="w-3 flex items-center justify-center mr-1.5">
          {item.icon && (
            <Codicon 
              icon={item.icon} 
              size={12} 
              className={item.disabled ? 'text-slate-500' : 'text-slate-300'}
            />
          )}
        </div>

        {/* Label */}
        <span className={`flex-1 text-[11px] ${item.disabled ? 'text-slate-500' : 'text-slate-200'}`}>
          {item.label}
        </span>

        {/* Keybinding or Submenu indicator */}
        {item.keybinding && (
          <span className="text-[9px] text-slate-500 ml-3 opacity-70">
            {item.keybinding}
          </span>
        )}
        {item.submenu && (
          <Codicon icon="chevron-right" size={10} className="text-slate-500 ml-1.5" />
        )}
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] py-0.5 bg-[#1e1e1e] border border-white/10 rounded shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
      }}
      role="menu"
      aria-orientation="vertical"
    >
      {items.map(renderItem)}
    </div>
  )
}

export default ContextMenu
