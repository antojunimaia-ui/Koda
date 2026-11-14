import { Message, ContentPart } from '../providers/base.js'
import { estimateTokens, formatTokenCount } from '../utils/tokens.js'

export class Conversation {
  private messages: Message[] = []
  private maxContextTokens: number

  constructor(systemPrompt: string, maxContextTokens = 100_000) {
    this.maxContextTokens = maxContextTokens
    this.messages.push({
      role: 'system',
      content: systemPrompt,
    })
  }

  updateSystemPrompt(newPrompt: string): void {
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = newPrompt
    } else {
      this.messages.unshift({ role: 'system', content: newPrompt })
    }
  }

  addUser(content: string, images?: ContentPart[]): void {
    if (images && images.length > 0) {
      const parts: ContentPart[] = [{ type: 'text', text: content }, ...images]
      this.messages.push({ role: 'user', content: parts })
    } else {
      this.messages.push({ role: 'user', content })
    }
  }

  addAssistant(content: string, toolCalls?: Message['toolCalls'], thought?: any): void {
    this.messages.push({
      role: 'assistant',
      content,
      thought,
      toolCalls,
    })
  }

  addToolResult(toolCallId: string, content: string, toolName?: string): void {
    this.messages.push({
      role: 'tool',
      content,
      toolCallId,
      toolName,
    })
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  getTokenEstimate(): number {
    return estimateTokens(this.messages.map((m) => m.content).join('\n'))
  }

  getFormattedTokenCount(): string {
    return formatTokenCount(this.getTokenEstimate())
  }

  getMessageCount(): number {
    return this.messages.length
  }

  /**
   * True quando a estimativa atual de tokens atinge `ratio` do orçamento.
   * Usado para disparar a compactação por resumo antes de estourar.
   */
  shouldCompactAt(ratio = 0.95): boolean {
    return this.getTokenEstimate() >= this.maxContextTokens * ratio
  }

  /**
   * Substitui as mensagens antigas por um resumo (gerado pelo modelo),
   * mantendo o system prompt e as últimas `keepRecent` mensagens intactas.
   * Retorna quantas mensagens foram removidas/absorvidas pelo resumo.
   */
  applyCompaction(summary: string, keepRecent = 8): { removed: number } {
    if (this.messages.length <= 1) return { removed: 0 }

    const removed = Math.max(0, this.messages.length - 1 - keepRecent)
    const system = this.messages[0]
    const recent = this.messages.slice(-keepRecent)

    const summaryMsg: Message = {
      role: 'user',
      content: `[CONTEXTO COMPACTADO — resumo da parte anterior da conversa]\n\n${summary}`,
    }

    this.messages = [system, summaryMsg, ...recent]
    return { removed }
  }

  /**
   * Trim old messages to stay within token limits,
   * always preserving the system message and the last N messages.
   * Fallback de segurança — o fluxo principal é a compactação por resumo.
   */
  trimIfNeeded(preserveLastN = 10): boolean {
    const estimate = this.getTokenEstimate()
    if (estimate <= this.maxContextTokens) return false

    const system = this.messages[0]
    const recent = this.messages.slice(-preserveLastN)

    // Create a summary of trimmed messages
    const trimmedCount = this.messages.length - 1 - preserveLastN
    const summaryMsg: Message = {
      role: 'user',
      content: `[Context note: ${trimmedCount} earlier messages were trimmed to fit context window. The conversation continues from the recent messages below.]`,
    }

    this.messages = [system, summaryMsg, ...recent]
    return true
  }

  clear(): void {
    const system = this.messages[0]
    this.messages = [system]
  }

  /**
   * Truncates the conversation history to the given length.
   * Used during a Snapshot Rollback to restore agent memory.
   */
  truncateToLength(length: number): void {
    if (length < 1) {
      this.clear()
    } else {
      this.messages = this.messages.slice(0, length)
    }
  }

  setMessages(messages: Message[]): void {
    this.messages = [...messages]
  }
}
