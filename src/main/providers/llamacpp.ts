import OpenAI from "openai";
import { BaseProvider, Message, StreamChunk, ToolCall } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

export class LlamaCppProvider extends BaseProvider {
  private client: OpenAI;

  constructor(
    model: string,
    apiKey: string, // Not strictly required for llama.cpp but part of interface
    maxTokens: number,
    temperature: number
  ) {
    super(model, apiKey, maxTokens, temperature);
    // llama.cpp default server endpoint
    this.client = new OpenAI({
      baseURL: "http://localhost:8080/v1",
      apiKey: apiKey || "llama.cpp",
    });
  }

  get providerName() {
    return "Llama.cpp";
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
        messages: openAIMessages as any[],
        // llama.cpp server might support tool formats via grammar but it varies
        tools: openAITools.length > 0 ? openAITools : undefined,
        max_tokens: this.maxTokens || 4096,
        temperature: this.temperature ?? 0.7,
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

        // Handle tool calls (Supported by openai package, though Llama.cpp may not implement fully)
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
            } catch {
              yield {
                type: "error",
                error: `Llama.cpp: Failed to parse tool arguments for ${tc.name}`,
              };
            }
          }
        }

        if (choice.finish_reason === "stop") {
          yield { type: "done" };
        }
      }
    } catch (err: any) {
      yield {
        type: "error",
        error: `Llama.cpp API error: ${err.message}\n(Make sure llama.cpp server is running at http://localhost:8080)`,
      };
    }
  }

  private convertMessages(
    messages: Message[]
  ): any[] {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: msg.content,
          tool_call_id: msg.toolCallId || "",
        };
      }

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        return {
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }
}
