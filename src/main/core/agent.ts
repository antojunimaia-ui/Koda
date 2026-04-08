import { BaseProvider, StreamChunk, ToolCall } from "../providers/base.js";
import { ToolRegistry } from "../tools/index.js";
import { Conversation } from "./conversation.js";
import { gatherProjectContext, ProjectContext } from "./context.js";
import { AppSettings, getSettings } from "../config/settings.js";
import { PromptBuilder } from "./prompt-builder.js";
import { OpenAIProvider } from "../providers/openai.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { GoogleProvider } from "../providers/google.js";
import { OpenRouterProvider } from "../providers/openrouter.js";
import { OllamaProvider } from "../providers/ollama.js";
import { LlamaCppProvider } from "../providers/llamacpp.js";
import { GroqProvider } from "../providers/groq.js";
import { DeepSeekProvider } from "../providers/deepseek.js";
import { MistralProvider } from "../providers/mistral.js";
import { TogetherProvider } from "../providers/together.js";
import { XAIProvider } from "../providers/xai.js";
import { ZhipuProvider } from "../providers/zhipu.js";
import { MaritacaProvider } from "../providers/maritaca.js";



export class Agent {
  private provider: BaseProvider | null = null;
  private tools: ToolRegistry;
  private conversation: Conversation;
  private settings: AppSettings;
  private projectContext: ProjectContext | null = null;
  private isProcessing = false;
  private dynamicSystemPrompt: string;

  constructor() {
    this.settings = getSettings();
    this.tools = new ToolRegistry();
    
    // Build initial robust system prompt
    this.dynamicSystemPrompt = PromptBuilder.build(this.settings.systemPrompt);
    this.conversation = new Conversation(this.dynamicSystemPrompt);
  }

  private async createProviderAsync(): Promise<BaseProvider> {
    const { provider, model, apiKey, maxTokens, temperature } = this.settings;

    switch (provider) {
      case "openai":
        return new OpenAIProvider(model, apiKey, maxTokens, temperature);
      case "anthropic":
        return new AnthropicProvider(model, apiKey, maxTokens, temperature);
      case "google":
        return new GoogleProvider(model, apiKey, maxTokens, temperature);
      case "openrouter":
        return new OpenRouterProvider(model, apiKey, maxTokens, temperature);
      case "ollama":
        return new OllamaProvider(model, apiKey, maxTokens, temperature);
      case "llamacpp":
        return new LlamaCppProvider(model, apiKey, maxTokens, temperature);
      case "groq":
        return new GroqProvider(model, apiKey, maxTokens, temperature);
      case "deepseek":
        return new DeepSeekProvider(model, apiKey, maxTokens, temperature);
      case "mistral":
        return new MistralProvider(model, apiKey, maxTokens, temperature);
      case "together":
        return new TogetherProvider(model, apiKey, maxTokens, temperature);
      case "xai":
        return new XAIProvider(model, apiKey, maxTokens, temperature);
      case "zhipu":
        return new ZhipuProvider(model, apiKey, maxTokens, temperature);
      case "maritaca":
        return new MaritacaProvider(model, apiKey, maxTokens, temperature);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async initialize(): Promise<void> {
    // Run context gathering and provider loading in parallel
    const [context, provider] = await Promise.all([
      gatherProjectContext(),
      this.createProviderAsync(),
    ]);

    this.projectContext = context;
    this.provider = provider;

    // Inject project context into conversation
    if (this.projectContext.summary) {
      this.conversation.addUser(
        `[System Context] Here is information about the current project:\n\n${this.projectContext.summary}\n\nPlease acknowledge you understand the project context briefly.`
      );
      // We don't actually send this - we'll prepend it as context
    }
  }

  getInfo(): {
    provider: string;
    model: string;
    project: string;
    cwd: string;
  } {
    return {
      provider: this.provider?.providerName ?? this.settings.provider,
      model: this.settings.model,
      project: this.projectContext?.name ?? "...",
      cwd: process.cwd(),
    };
  }

  async processMessage(
    userMessage: string,
    onText: (text: string) => void,
    onToolStart: (name: string) => void,
    onToolEnd: (name: string, result: string, success: boolean) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.provider) {
      onError("Agent not ready. Please wait for initialization.");
      return;
    }
    if (this.isProcessing) {
      onError("Already processing a message. Please wait.");
      return;
    }

    // Process Slash Commands natively
    const commandText = userMessage.trim().toLowerCase();
    if (commandText.startsWith("/")) {
      if (commandText === "/clear" || commandText === "/reset") {
        this.resetConversation();
        onText("✨ Conversation memory cleared. Starting fresh!");
        return;
      }
      
      if (commandText === "/tokens" || commandText === "/cost") {
        onText(`📊 Current token estimate:\n${this.getTokenEstimate()}`);
        return;
      }
      
      if (commandText === "/help") {
        onText("🛠️ **Available Koda Commands:**\n\n- `/clear` or `/reset`: Clears current conversation history and agent memory\n- `/tokens` or `/cost`: Displays an estimate of LLM token usage and cost\n- `/help`: Displays this help menu\n\n*Tip: Click on the **PATH** display in the header to change your working directory natively.*");
        return
      }
      
      onText(`⚠️ Unknown command: \`${commandText}\`\nType \`/help\` to see the list of available commands.`);
      return;
    }

    this.isProcessing = true;

    // Detect Planner Mode from the message wrapper generated by the UI
    const isPlannerMode = userMessage.includes("[PLANNER MODE PROTOCOL - MANDATORY]");
    this.tools.setActiveMode(isPlannerMode ? "planner" : "fast");

    try {
      // Add context to first user message
      let messageToSend = userMessage;
      if (
        this.conversation.getMessageCount() <= 1 &&
        this.projectContext?.summary
      ) {
        messageToSend = `[Project Context]\n${this.projectContext.summary}\n\n[User Message]\n${userMessage}`;
      }

      this.conversation.addUser(messageToSend);

      let iterations = 0;

      while (true) {
        iterations++;

        // Trim context if needed
        this.conversation.trimIfNeeded();

        const messages = this.conversation.getMessages();
        let assistantText = "";
        let assistantThoughts: any[] = [];
        const pendingToolCalls: ToolCall[] = [];
        let hasToolCalls = false;

        // Stream response from LLM
        for await (const chunk of this.provider.chat(
          messages,
          this.tools
        )) {
          switch (chunk.type) {
            case "text":
              assistantText += chunk.content || "";
              onText(chunk.content || "");
              break;

            case "thought":
              if (chunk.thoughtData) {
                assistantThoughts.push(chunk.thoughtData);
              } else if (chunk.content) {
                assistantThoughts.push({ thought: chunk.content });
              }
              break;

            case "tool_call_start":
              hasToolCalls = true;
              if (chunk.toolCall?.name) {
                onToolStart(chunk.toolCall.name);
              }
              break;

            case "tool_call_end":
              if (chunk.toolCall?.name && chunk.toolCall?.id) {
                pendingToolCalls.push(chunk.toolCall as ToolCall);
              }
              break;

            case "error":
              onError(chunk.error || "Unknown error");
              break;

            case "done":
              break;
          }
        }

        // Save assistant message
        this.conversation.addAssistant(
          assistantText,
          hasToolCalls ? pendingToolCalls : undefined,
          assistantThoughts.length > 0 ? assistantThoughts : undefined
        );

        // If there are tool calls, execute them
        if (pendingToolCalls.length > 0) {
          for (const toolCall of pendingToolCalls) {
            const result = await this.tools.execute(
              toolCall.name,
              toolCall.arguments
            );

            const success = result.success;
            const output = result.error || result.output;

            onToolEnd(toolCall.name, output, success);

            // Add tool result to conversation
            this.conversation.addToolResult(
              toolCall.id,
              success
                ? output
                : `Error: ${output}`
            );
          }

          // Continue the loop so the LLM can respond to tool results
          continue;
        }

        // No tool calls - we're done
        break;
      }


    } catch (err) {
      onError(`Agent error: ${(err as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async setApiKey(key: string): Promise<void> {
    this.settings.apiKey = key;
    this.provider = await this.createProviderAsync();
  }

  async setModel(model: string): Promise<void> {
    this.settings.model = model;

    // Detect provider from model name
    if (model.includes("/")) {
      this.settings.provider = "openrouter";
    } else if (model.includes("claude")) {
      this.settings.provider = "anthropic";
    } else if (model.includes("gemini")) {
      this.settings.provider = "google";
    } else if (model.includes("gpt-") || model.includes("o1") || model.includes("o3")) {
      this.settings.provider = "openai";
    } else if (model.includes("llama") || model.includes("qwen") || model.includes("mistral") || model.includes("phi")) {
      // Common Ollama model patterns
      this.settings.provider = "ollama";
    } else if (model.includes("local") || model.includes("localhost")) {
      this.settings.provider = "llamacpp";
    } else if (model.includes("groq")) {
      this.settings.provider = "groq";
    } else if (model.includes("deepseek")) {
      this.settings.provider = "deepseek";
    } else if (model.includes("mistral") || model.includes("codestral")) {
      this.settings.provider = "mistral";
    } else if (model.includes("together")) {
      this.settings.provider = "together";
    } else if (model.includes("grok") || model.includes("xai")) {
      this.settings.provider = "xai";
    } else if (model.includes("glm") || model.includes("zhipu")) {
      this.settings.provider = "zhipu";
    } else if (model.includes("sabia") || model.includes("maritaca")) {
      this.settings.provider = "maritaca";
    }

    this.provider = await this.createProviderAsync();
  }

  async updateSettings(updates: { provider?: any, model?: string, apiKey?: string }): Promise<void> {
    if (updates.provider) this.settings.provider = updates.provider;
    if (updates.model) this.settings.model = updates.model;
    if (updates.apiKey !== undefined) this.settings.apiKey = updates.apiKey;
    
    this.provider = await this.createProviderAsync();
  }

  resetConversation(): void {
    // Re-evaluate context at reset
    this.dynamicSystemPrompt = PromptBuilder.build(
      this.settings.systemPrompt,
      { workspaceName: this.projectContext?.name }
    );
    this.conversation = new Conversation(this.dynamicSystemPrompt);
    if (this.projectContext?.summary) {
      this.conversation.addUser(
        `[System Context] ${this.projectContext.summary}`
      );
    }
  }

  /**
   * Rolls back the agent's conversation memory to `conversationLength`.
   * Called after restoring a file snapshot to keep memory in sync.
   */
  rollbackConversation(conversationLength: number): void {
    this.conversation.truncateToLength(conversationLength);
  }

  getConversationLength(): number {
    return this.conversation.getMessageCount();
  }

  getTokenEstimate(): string {
    return this.conversation.getFormattedTokenCount();
  }
}
