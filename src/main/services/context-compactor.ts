import { BaseProvider, Message } from '../providers/base.js'

// Tools vazias — o resumo NÃO deve executar ferramentas.
const DUMMY_TOOLS = {
  toOpenAITools: () => [],
  toAnthropicTools: () => [],
  toGoogleTools: () => [],
} as any

export const COMPACTION_RATIO = 0.95
export const COMPACTION_KEEP_RECENT = 8

/** Monta o prompt padronizado de resumo a partir do histórico da conversa. */
export function buildCompactionPrompt(messages: Message[]): string {
  const transcript = messages
    .map((m) => {
      let content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      if (m.toolCalls?.length) {
        content += `\n[tool_calls: ${JSON.stringify(m.toolCalls)}]`
      }
      return `[${m.role}]\n${content}`
    })
    .join('\n\n')

  return `Você é o compressor de contexto de uma sessão com um agente de codificação autônomo.

A conversa abaixo está atingindo o limite de contexto. Resuma-a em formato estruturado e conciso, preservando exatamente o que ainda é relevante para continuar o trabalho.

# SEÇÕES OBRIGATÓRIAS NO RESUMO
- OBJETIVO: o que o usuário quer alcançar neste momento
- DECISÕES: escolhas técnicas e arquiteturais já feitas
- ARQUIVOS: caminhos completos e o que foi feito/observado neles
- RESULTADOS: saídas importantes de ferramentas (erros, dados, achados)
- PENDÊNCIAS: tarefas pela metade e próximos passos
- REGRAS/PREFERÊNCIAS: coisas que o usuário pediu que sejam respeitadas

Regras de estilo:
- Escreva APENAS o resumo, sem preâmbulo nem explicações.
- Seja denso e factual. Não invente informação que não está na conversa.
- Se algo não aparecer na conversa, omita a seção em vez de inventar.

--- CONVERSA ---
${transcript}`
}

/**
 * Chama o próprio modelo (provider atual) para resumir a conversa.
 * Lança erro se a compilação falhar.
 */
export async function summarizeConversation(provider: BaseProvider, messages: Message[]): Promise<string> {
  let summary = ''
  for await (const chunk of provider.chat(
    [
      {
        role: 'system',
        content: 'Você é um compressor de contexto especializado. Produz apenas resumos estruturados.',
      },
      { role: 'user', content: buildCompactionPrompt(messages) },
    ],
    DUMMY_TOOLS,
  )) {
    if (chunk.type === 'error') {
      throw new Error(chunk.error || 'Summarization failed')
    }
    if (chunk.type === 'text') {
      summary += chunk.content || ''
    }
  }
  const trimmed = summary.trim()
  if (!trimmed) {
    throw new Error('Summarization returned an empty summary')
  }
  return trimmed
}
