import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider, Message, StreamChunk } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(
    model: string,
    apiKey: string,
    maxTokens: number,
    temperature: number
  ) {
    super(model, apiKey, maxTokens, temperature);
    this.client = new Anthropic({ apiKey });
  }

  get providerName() {
    return "Anthropic";
  }

  async *chat(
    messages: Message[],
    tools: ToolRegistry
  ): AsyncGenerator<StreamChunk> {
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const anthropicMessages = this.convertMessages(
      messages.filter((m) => m.role !== "system")
    );
    const anthropicTools = tools.toAnthropicTools();

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        system: systemMessage,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? (anthropicTools as Anthropic.Tool[]) : undefined,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      let currentToolId = "";
      let currentToolName = "";
      let currentToolArgs = "";

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolId = event.content_block.id;
            currentToolName = event.content_block.name;
            currentToolArgs = "";
            yield {
              type: "tool_call_start",
              toolCall: { id: currentToolId, name: currentToolName },
            };
          }
        }

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield { type: "text", content: event.delta.text };
          }
          if (event.delta.type === "input_json_delta") {
            currentToolArgs += event.delta.partial_json;
            yield {
              type: "tool_call_args",
              content: event.delta.partial_json,
            };
          }
        }

        if (event.type === "content_block_stop") {
          if (currentToolName) {
            try {
              const args = currentToolArgs
                ? JSON.parse(currentToolArgs)
                : {};
              yield {
                type: "tool_call_end",
                toolCall: {
                  id: currentToolId,
                  name: currentToolName,
                  arguments: args,
                },
              };
            } catch {
              yield {
                type: "error",
                error: `Failed to parse tool arguments for ${currentToolName}`,
              };
            }
            currentToolName = "";
            currentToolArgs = "";
          }
        }

        if (event.type === "message_stop") {
          yield { type: "done" };
        }
      }
    } catch (err) {
      yield {
        type: "error",
        error: `Anthropic API error: ${(err as Error).message}`,
      };
    }
  }

  private convertMessages(
    messages: Message[]
  ): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "assistant") {
        const content: Anthropic.ContentBlockParam[] = [];

        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }

        result.push({
          role: "assistant",
          content: content.length > 0 ? content : msg.content,
        });
      } else if (msg.role === "tool") {
        result.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId || "",
              content: msg.content,
            },
          ],
        });
      } else {
        result.push({
          role: "user",
          content: msg.content,
        });
      }
    }

    return result;
  }
}
