import { BaseProvider, StreamChunk, Message } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

/**
 * KodaCloudProvider — A special provider that tunnels requests to a private 
 * backend proxy. This allows Koda to provide premium models (like Gemini/Claude) 
 * without exposing API keys in the client code.
 */
export class KodaCloudProvider extends BaseProvider {
  public providerName = "Koda Cloud";
  private proxyUrl: string;

  constructor(model: string, proxyUrl: string = "http://cn-01.hostzera.com.br:2137/v1/chat") {
    // Model name is passed but could be overridden by the proxy
    super(model, "", 4096, 0.7);
    this.proxyUrl = proxyUrl;
  }

  async *chat(messages: Message[], tools?: ToolRegistry): AsyncGenerator<StreamChunk> {
    try {
      const response = await fetch(this.proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // You can add a custom auth header here later
          "x-koda-client": "desktop-electron"
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          // If the proxy supports tools, we could pass them here
          // tools: tools?.getAll().map(...)
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        yield { type: "error", error: `Cloud Proxy Error: ${err}` };
        return;
      }

      if (!response.body) {
        yield { type: "error", error: "Cloud Proxy returned an empty body" };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          
          try {
            const data = JSON.parse(line.replace("data: ", ""));
            
            // Map the proxy JSON output to StreamChunk
            // The proxy should return chunks in a compatible format
            if (data.type === "text") {
              yield { type: "text", content: data.content };
            } else if (data.type === "thought") {
              yield { type: "thought", content: data.content };
            } else if (data.type === "tool_call_start") {
              yield { type: "tool_call_start", toolCall: data.toolCall };
            } else if (data.type === "tool_call_end") {
              yield { type: "tool_call_end", toolCall: data.toolCall };
            }
          } catch (e) {
            console.error("Error parsing proxy chunk:", e);
          }
        }
      }
      
      yield { type: "done" };

    } catch (err: any) {
      yield { type: "error", error: `Failed to connect to Koda Cloud: ${err.message}` };
    }
  }
}
