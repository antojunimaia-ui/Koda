import { ToolRegistry } from "../tools/index.js";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  thought?: any;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  [key: string]: any;
}

export interface StreamChunk {
  type: "text" | "thought" | "tool_call_start" | "tool_call_args" | "tool_call_end" | "done" | "error";
  content?: string;
  thoughtData?: any;
  toolCall?: Partial<ToolCall>;
  error?: string;
}

export abstract class BaseProvider {
  protected model: string;
  protected apiKey: string;
  protected maxTokens: number;
  protected temperature: number;

  constructor(
    model: string,
    apiKey: string,
    maxTokens: number,
    temperature: number
  ) {
    this.model = model;
    this.apiKey = apiKey;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
  }

  abstract chat(
    messages: Message[],
    tools: ToolRegistry
  ): AsyncGenerator<StreamChunk>;

  abstract get providerName(): string;
}
