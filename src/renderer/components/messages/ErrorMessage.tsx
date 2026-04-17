import React, { memo } from 'react'

const ErrorMessage = memo(({ text }: { text: string }) => (
  <div className="ml-4 flex gap-2 items-center" style={{ color: 'var(--koda-status-error)' }}>
    <span>✖</span>
    <span className="font-bold text-xs">{text}</span>
  </div>
))

ErrorMessage.displayName = 'ErrorMessage'

export default ErrorMessage
