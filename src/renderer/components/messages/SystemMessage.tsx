import React, { memo } from 'react'

const SystemMessage = memo(({ text }: { text: string }) => (
  <div className="ml-4 text-slate-500 italic text-[11px] flex gap-2 items-center">
    <span>ℹ</span>
    <span className="whitespace-pre-wrap">{text}</span>
  </div>
))

SystemMessage.displayName = 'SystemMessage'

export default SystemMessage
