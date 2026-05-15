import { net } from "electron";
import { BaseProvider, Message, StreamChunk } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GoogleProvider extends BaseProvider {
  constructor(
    model: string,
    apiKey: string,
    maxTokens: number,
    temperature: number
  ) {
    super(model, apiKey, maxTokens, temperature);
  }

  get providerName() {
    return "Google";
  }

  async *chat(
    messages: Message[],
    tools: ToolRegistry
  ): AsyncGenerator<StreamChunk> {
    const rawSystem = messages.find((m) => m.role === "system")?.content;
    const systemInstruction = Array.isArray(rawSystem) ? undefined : (rawSystem ? { parts: [{ text: rawSystem }] } : undefined);
    const contents = this.convertMessages(messages.filter((m) => m.role !== "system"));

    const geminiTools = tools.toGoogleTools();
    const functionDeclarations = geminiTools.map((t) => {
      const properties: Record<string, any> = {};
      const rawProps = t.parameters.properties as Record<string, { type: string; description: string }>;
      for (const [key, value] of Object.entries(rawProps)) {
        const typeMap: Record<string, string> = {
          NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", ARRAY: "ARRAY", STRING: "STRING",
        };
        const type = typeMap[value.type?.toUpperCase()] || "STRING";
        properties[key] = {
          type,
          description: value.description,
          ...(type === "ARRAY" ? { items: { type: "STRING" } } : {}),
        };
      }
      return {
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT",
          properties,
          required: t.parameters.required as string[],
        },
      };
    });

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
      },
    };

    if (systemInstruction) body.systemInstruction = systemInstruction;
    if (functionDeclarations.length > 0) body.tools = [{ functionDeclarations }];

    const url = `${GEMINI_BASE}/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    try {
      const res = await net.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          let chunk: any;
          try { chunk = JSON.parse(jsonStr); } catch { continue; }

          const candidate = chunk.candidates?.[0];
          if (!candidate?.content?.parts) continue;

          for (const part of candidate.content.parts) {
            if (part.thought) {
              yield { type: "thought", content: part.thought, thoughtData: part };
            }
            if (part.text) {
              yield { type: "text", content: part.text };
            }
            if (part.functionCall) {
              const toolCallId = `google_${Date.now()}_${Math.random().toString(36).slice(2)}`;
              yield {
                type: "tool_call_start",
                toolCall: { id: toolCallId, name: part.functionCall.name },
              };
              yield {
                type: "tool_call_end",
                toolCall: {
                  id: toolCallId,
                  name: part.functionCall.name,
                  arguments: (part.functionCall.args || {}) as Record<string, unknown>,
                  _rawPart: part,
                },
              };
            }
          }
        }
      }

      yield { type: "done" };
    } catch (err) {
      yield {
        type: "error",
        error: `Google API error: ${(err as Error).message}`,
      };
    }
  }

  private convertMessages(messages: Message[]): any[] {
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "assistant") {
        const parts: any[] = [];

        if (msg.thought) {
          if (Array.isArray(msg.thought)) parts.push(...msg.thought);
          else if (typeof msg.thought === "object") parts.push(msg.thought);
          else parts.push({ thought: msg.thought });
        }

        if (msg.content && !Array.isArray(msg.content)) {
          parts.push({ text: msg.content });
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            if (tc._rawPart) {
              parts.push(tc._rawPart);
            } else {
              parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
            }
          }
        }

        contents.push({ role: "model", parts });
      } else if (msg.role === "tool") {
        contents.push({
          role: "function",
          parts: [{
            functionResponse: {
              name: msg.toolCallId || "unknown",
              response: { result: msg.content },
            },
          }],
        });
      } else {
        // user — may be multimodal
        if (Array.isArray(msg.content)) {
          const parts = msg.content.map((part: any) => {
            if (part.type === "image" && part.image) {
              return {
                inlineData: {
                  mimeType: part.image.mimeType,
                  data: part.image.dataUrl.split(",")[1] || "",
                },
              };
            }
            return { text: part.text || "" };
          });
          contents.push({ role: "user", parts });
        } else {
          contents.push({ role: "user", parts: [{ text: msg.content as string }] });
        }
      }
    }

    return contents;
  }
}
