import OpenAI from "openai";
import { BaseProvider, Message, StreamChunk, ToolCall } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

export class OpenCodeZenProvider extends BaseProvider {
  private client: OpenAI;

  constructor(
    model: string,
    apiKey: string,
    maxTokens: number,
    temperature: number
  ) {
    super(model, apiKey, maxTokens, temperature);
    this.client = new OpenAI({
      apiKey: apiKey || "dummy-key",
      baseURL: "https://opencode.ai/zen/v1",
    });
  }

  get providerName() {
    return "OpenCode Zen";
  }

  async *chat(
    messages: Message[],
    tools: ToolRegistry
  ): AsyncGenerator<StreamChunk> {
    const openAIMessages = this.convertMessages(messages);
    const openAITools = tools.toOpenAITools();

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: openAIMessages,
        tools: openAITools.length > 0 ? openAITools : undefined,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: true,
      });

      const toolCalls: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;

        // Handle text content
        if (delta.content) {
          yield { type: "text", content: delta.content };
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;

            if (!toolCalls.has(index)) {
              toolCalls.set(index, { id: "", name: "", arguments: "" });
            }
            const current = toolCalls.get(index)!;

            if (tc.id) {
              current.id = tc.id;
            }
            if (tc.function?.name) {
              current.name = tc.function.name;
              yield {
                type: "tool_call_start",
                toolCall: { id: current.id, name: current.name },
              };
            }
            if (tc.function?.arguments) {
              current.arguments += tc.function.arguments;
              yield {
                type: "tool_call_args",
                content: tc.function.arguments,
              };
            }
          }
        }

        // Handle finish
        if (choice.finish_reason === "tool_calls") {
          for (const [, tc] of toolCalls) {
            try {
              const args = JSON.parse(tc.arguments);
              yield {
                type: "tool_call_end",
                toolCall: { id: tc.id, name: tc.name, arguments: args },
              };
            } catch (err) {
              yield {
                type: "error",
                error: `Failed to parse tool call arguments for ${tc.name}: ${tc.arguments}`,
              };
            }
          }
        }

        if (choice.finish_reason === "stop") {
          yield { type: "done" };
        }
      }
    } catch (err: any) {
      console.error("[OpenCodeZenProvider] Chat error:", err);
      yield {
        type: "error",
        error: `OpenCode Zen API Error: ${err.message || String(err)}`,
      };
    }
  }

  private convertMessages(
    messages: Message[]
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          content: Array.isArray(msg.content) ? JSON.stringify(msg.content) : msg.content,
          tool_call_id: msg.toolCallId || "",
        };
      }

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        return {
          role: "assistant" as const,
          content: Array.isArray(msg.content) ? null : (msg.content || null),
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }

      if (Array.isArray(msg.content) && msg.role === "user") {
        const parts: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map(part => {
          if (part.type === "image" && part.image) {
            return {
              type: "image_url" as const,
              image_url: { url: part.image.dataUrl },
            };
          }
          return { type: "text" as const, text: part.text || "" };
        });
        return { role: "user" as const, content: parts };
      }

      return {
        role: msg.role as "system" | "user" | "assistant",
        content: (Array.isArray(msg.content) ? "" : msg.content) as string,
      };
    });
  }
}
