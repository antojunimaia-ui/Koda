import { BaseProvider, Message, StreamChunk } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

/**
 * KodaCloudProvider — Koda Cloud proxy (operator-hosted).
 *
 * PRIVACY NOTICE: Each request sends the full conversation history and all
 * local agent tool schemas (names + argument definitions) to the configured
 * `baseUrl` endpoint via POST /v1/chat over the network.
 *
 * `baseUrl` MUST be explicitly configured by the user — there is no silent
 * default. If empty, `chat()` will yield an error instead of sending data.
 */
export class KodaCloudProvider extends BaseProvider {
  public providerName = "Koda Cloud";
  private baseUrl: string;

  constructor(model: string, baseUrl: string = "") {
    super(model, "", 4096, 0.7);
    this.baseUrl = baseUrl;
  }

  async *chat(messages: Message[], tools?: ToolRegistry): AsyncGenerator<StreamChunk> {
    if (!this.baseUrl) {
      yield {
        type: "error",
        error:
          "Koda Cloud: Base URL is not configured. Open Settings → Koda Cloud and enter the proxy endpoint before sending messages.",
      };
      return;
    }

    try {
      const openAIMessages = this.convertMessages(messages);
      const openAITools = tools ? tools.toOpenAITools() : [];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(`${this.baseUrl}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: openAIMessages,
          tools: openAITools.length > 0 ? openAITools : undefined,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: "error", error: `Koda Cloud Error (${response.status}): ${errorText.substring(0, 200)}` };
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let line of lines) {
          line = line.trim();
          if (!line || !line.startsWith("data: ")) continue;

          const rawData = line.substring(6).trim();
          if (rawData === "[DONE]") {
            yield { type: "done" };
            return;
          }

          let data: any;
          try {
            data = JSON.parse(rawData);
          } catch {
            continue;
          }

          switch (data.type) {
            case "text":
              if (data.content) yield { type: "text", content: data.content };
              break;

            case "tool_call_start":
              yield { type: "tool_call_start", toolCall: data.toolCall };
              break;

            case "tool_call_end":
              // Preserva _rawPart para que o histórico possa ser reconstruído
              // com thought_signature intacto (necessário para modelos thinking)
              yield { type: "tool_call_end", toolCall: data.toolCall };
              break;

            case "done":
              yield { type: "done" };
              return;

            case "error":
              yield { type: "error", error: data.error || "Unknown proxy error" };
              return;
          }
        }
      }

      yield { type: "done" };

    } catch (err: any) {
      if (err.name === "AbortError") {
        yield { type: "error", error: "Koda Cloud: request timed out (120s)" };
      } else {
        yield { type: "error", error: `Koda Cloud error: ${err.message}` };
      }
    }
  }

  /**
   * Converte mensagens internas para o formato OpenAI que o proxy aceita.
   * Inclui tool results (role: tool) e assistant com tool_calls.
   */
  private convertMessages(messages: Message[]): any[] {
    const result: any[] = [];

    for (const msg of messages) {
      const contentStr = typeof msg.content === "string"
        ? msg.content
        : (msg.content as any[])
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("\n");

      if (msg.role === "tool") {
        result.push({
          role: "tool",
          content: contentStr,
          tool_call_id: msg.toolCallId || "",
          // _toolName é lido pelo proxy para montar o functionResponse.name corretamente
          _toolName: msg.toolName || msg.toolCallId || "",
        });
        continue;
      }

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        result.push({
          role: "assistant",
          content: contentStr || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
              // Preserva thought_signature e _rawPart para modelos thinking
              ...(tc.thought_signature ? { thought_signature: tc.thought_signature } : {}),
              ...(tc._rawPart ? { _rawPart: tc._rawPart } : {}),
            },
          })),
        });
        continue;
      }

      result.push({
        role: msg.role as "system" | "user" | "assistant",
        content: contentStr,
      });
    }

    return result;
  }
}
