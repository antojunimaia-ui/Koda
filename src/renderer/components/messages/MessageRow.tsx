import React, { memo } from 'react'
import { MessageEntry, KodaSettings, AgentInfo } from '../../types/index.js'
import UserMessage from './UserMessage.js'
import AssistantMessage from './AssistantMessage.js'
import ToolMessage from './ToolMessage.js'
import ErrorMessage from './ErrorMessage.js'
import SystemMessage from './SystemMessage.js'
import PtyMessage from './PtyMessage.js'

interface MessageRowProps {
  msg: MessageEntry
  onRollback?: () => void
  kodaSettings: KodaSettings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentInfo: AgentInfo | any
  uiMode?: 'classic' | 'modern'
}

const MessageRow = memo(({ msg, onRollback, kodaSettings, agentInfo, uiMode = 'classic' }: MessageRowProps) => (
  <div className="flex flex-col text-sm">
    {msg.type === 'user' && (
      <UserMessage text={msg.text!} images={msg.images} onRollback={onRollback} remote={msg.remote} />
    )}
    {msg.type === 'assistant' && (
      <AssistantMessage text={msg.text} done={msg.done} uiMode={uiMode} />
    )}
    {msg.type === 'tool' && (
      <ToolMessage tool={msg.tool} settings={kodaSettings} agentInfo={agentInfo} uiMode={uiMode} />
    )}
    {msg.type === 'error' && <ErrorMessage text={msg.text!} />}
    {msg.type === 'system' && <SystemMessage text={msg.text!} />}
    {msg.type === 'pty' && <PtyMessage pty={msg.pty} settings={kodaSettings} />}
  </div>
))

MessageRow.displayName = 'MessageRow'

export default MessageRow
