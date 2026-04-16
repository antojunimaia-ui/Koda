import { BaseProvider, StreamChunk, Message } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

/**
 * KodaCloudProvider — A specialized provider for Hostzera Koda Cloud Proxy.
 * Handles role alternation, system prompt merging, and tool-call interception.
 */
export class KodaCloudProvider extends BaseProvider {
  public providerName = "Koda Cloud";
  private proxyUrl: string;

  constructor(model: string, proxyUrl: string = "http://cn-01.hostzera.com.br:2137/v1/chat") {
    super(model, "", 4096, 0.7);
    this.proxyUrl = proxyUrl;
  }

  async *chat(messages: Message[], tools?: ToolRegistry): AsyncGenerator<StreamChunk> {
    try {
      // 1. Prepare history for Gemini Proxy (Strict Alternation)
      let simplifiedMessages: { role: string, content: string }[] = [];
      let systemBuffer = "";

      for (const m of messages) {
        let contentStr = "";
        if (typeof m.content === "string") {
          contentStr = m.content;
        } else if (Array.isArray(m.content)) {
          contentStr = m.content
            .filter(part => (part as any).type === "text")
            .map(part => (part as any).text)
            .join("\n");
        }

        if (m.role === "system") {
          systemBuffer += contentStr + "\n\n";
          continue;
        }

        const role = m.role === "assistant" ? "assistant" : "user";
        let finalContent = contentStr.trim() || "(...)";

        if (systemBuffer && role === "user" && simplifiedMessages.length === 0) {
          finalContent = `Instructions:\n${systemBuffer.trim()}\n\nCurrent Query: ${finalContent}`;
          systemBuffer = ""; 
        }

        if (simplifiedMessages.length > 0 && simplifiedMessages[simplifiedMessages.length - 1].role === role) {
          simplifiedMessages[simplifiedMessages.length - 1].content += "\n\n" + finalContent;
        } else {
          simplifiedMessages.push({ role, content: finalContent });
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(this.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: simplifiedMessages,
          stream: true,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: "error", error: `Cloud Proxy Error (${response.status}): ${errorText.substring(0, 100)}` };
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolCallBuffer = "";
      let isInToolCall = false;

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
          if (rawData === "[DONE]") break;

          try {
            const data = JSON.parse(rawData);
            const text = data.content || data.text || data.delta?.content;

            if (text) {
              // INTERCEPTOR: Se o texto parecer o início de um JSON de ferramenta
              if (!isInToolCall && text.includes('{') && (text.includes('"tool"') || text.includes('"command"'))) {
                isInToolCall = true;
                toolCallBuffer = text;
                continue;
              }

              if (isInToolCall) {
                toolCallBuffer += text;
                // Se fecharmos o JSON, tentamos disparar como ferramenta
                if (toolCallBuffer.includes('}')) {
                  try {
                    const maybeTool = JSON.parse(toolCallBuffer.substring(toolCallBuffer.indexOf('{'), toolCallBuffer.lastIndexOf('}') + 1));
                    if (maybeTool.tool || maybeTool.command) {
                      yield { 
                        type: "tool_call_start", 
                        toolCall: { 
                          id: `cloud-${Date.now()}`,
                          name: maybeTool.tool || "shell", 
                          arguments: maybeTool.arguments || { command: maybeTool.command } 
                        } 
                      };
                      yield { type: "tool_call_end", toolCall: { name: maybeTool.tool || "shell", id: `cloud-${Date.now()}` } as any };
                      isInToolCall = false;
                      toolCallBuffer = "";
                      continue;
                    }
                  } catch (e) {
                    // Se falhar o parse, continua acumulando ou libera como texto se demorar muito
                  }
                }
                continue;
              }

              yield { type: "text", content: text };
            } else if (data.type === "tool_call_start" || data.toolCall) {
              yield { type: "tool_call_start", toolCall: data.toolCall };
            }
          } catch (e) { /* silent parse fail */ }
        }
      }
      
      yield { type: "done" };

    } catch (err: any) {
      yield { type: "error", error: `Cloud error: ${err.message}` };
    }
  }
}
