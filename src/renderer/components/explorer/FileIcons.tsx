import React from 'react'
import { getIconForFile } from 'vscode-icons-js'

export const IconChevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`flex-shrink-0 transition-transform duration-150 text-slate-600 ${open ? 'rotate-90' : ''}`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export const IconFolder: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 text-amber-400/80"
  >
    {open ? (
      <>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ) : (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    )}
  </svg>
)

export const IconFile: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
    <path
      d="M28 4H14L10 8H4C2.9 8 2 8.9 2 10V26C2 27.1 2.9 28 4 28H28C29.1 28 30 27.1 30 26V6C30 4.9 29.1 4 28 4Z"
      fill="#6B7280"
    />
  </svg>
)

export const getFileIcon = (filename: string) => {
  const iconName = getIconForFile(filename)
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${iconName}`}
      width="16"
      height="16"
      className="flex-shrink-0"
      alt={filename}
      style={{ objectFit: 'contain' }}
    />
  )
}

export const IconAt: React.FC = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 text-indigo-400"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </svg>
)

export const IconPin: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={active ? 'text-indigo-400' : 'text-slate-600 hover:text-indigo-400'}
  >
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
)
