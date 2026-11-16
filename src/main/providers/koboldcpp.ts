import OpenAI from 'openai'
import { BaseProvider, Message, StreamChunk, ToolCall } from './base.js'
import { ToolRegistry } from '../tools/index.js'

/** Candidatos a endpoint do KoboldCpp (localhost pode resolver p/ ::1 no Windows). */
const DEFAULT_HOSTS = ['http://127.0.0.1:5001', 'http://localhost:5001']

async function probeBaseUrl(): Promise<string> {
  for (const host of DEFAULT_HOSTS) {
    try {
      const res = await fetch(`${host}/v1/models`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return `${host}/v1`
    } catch {
      /* tenta o próximo */
    }
  }
  return `${DEFAULT_HOSTS[0]}/v1`
}

/**
 * KoboldCpp — servidor local de inferência (GGUF) com API compatível com
 * OpenAI em `http://127.0.0.1:5001/v1` (ou localhost). Não exige API key.
 */
export class KoboldCppProvider extends BaseProvider {
  private client: OpenAI | undefined
  private _baseUrl?: string
  private _resolvedUrl: string | null = null

  constructor(
    model: string,
    apiKey: string, // not strictly required, part of the interface
    maxTokens: number,
    temperature: number,
    baseUrl?: string,
  ) {
    super(model, apiKey, maxTokens, temperature)
    this._baseUrl = baseUrl
  }

  private async ensureClient(): Promise<OpenAI> {
    if (this.client) return this.client
    const baseUrl = this._resolvedUrl ?? this._baseUrl ?? (await probeBaseUrl())
    this._resolvedUrl = baseUrl
    this.client = new OpenAI({ baseURL: baseUrl, apiKey: this.apiKey || 'koboldcpp' })
    return this.client
  }

  get providerName() {
    return 'KoboldCpp'
  }

  async *chat(messages: Message[], tools: ToolRegistry): AsyncGenerator<StreamChunk> {
    const openAIMessages = this.convertMessages(messages)
    const openAITools = tools.toOpenAITools()

    try {
      const client = await this.ensureClient()
      const stream = await client.chat.completions.create({
        model: this.model,
        messages: openAIMessages as any[],
        tools: openAITools.length > 0 ? openAITools : undefined,
        max_tokens: this.maxTokens || 4096,
        temperature: this.temperature ?? 0.7,
        stream: true,
      })

      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

      for await (const chunk of stream) {
        const choice = chunk.choices[0]
        if (!choice) continue

        const delta = choice.delta

        if (delta.content) {
          yield { type: 'text', content: delta.content }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index
            if (!toolCalls.has(index)) {
              toolCalls.set(index, { id: '', name: '', arguments: '' })
            }
            const current = toolCalls.get(index)!
            if (tc.id) current.id = tc.id
            if (tc.function?.name) {
              current.name = tc.function.name
              yield { type: 'tool_call_start', toolCall: { id: current.id, name: current.name } }
            }
            if (tc.function?.arguments) {
              current.arguments += tc.function.arguments
              yield { type: 'tool_call_args', content: tc.function.arguments }
            }
          }
        }

        if (choice.finish_reason === 'tool_calls') {
          for (const [, tc] of toolCalls) {
            try {
              const args = JSON.parse(tc.arguments)
              yield { type: 'tool_call_end', toolCall: { id: tc.id, name: tc.name, arguments: args } }
            } catch {
              yield { type: 'error', error: `KoboldCpp: Failed to parse tool arguments for ${tc.name}` }
            }
          }
        }

        if (choice.finish_reason === 'stop') {
          yield { type: 'done' }
        }
      }
    } catch (err: any) {
      yield {
        type: 'error',
        error: `KoboldCpp API error: ${err.message}\n(Make sure KoboldCpp is running at http://localhost:5001)`,
      }
    }
  }

  private convertMessages(messages: Message[]): any[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId || '' }
      }
      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        return {
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        }
      }
      return { role: msg.role, content: msg.content }
    })
  }
}
