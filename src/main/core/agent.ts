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

const MAX_TOOL_ITERATIONS = 25;

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
        onText("✨ Memória da conversa reiniciada. Estamos começando do zero!");
        return;
      }
      
      if (commandText === "/tokens" || commandText === "/cost") {
        onText(`📊 Estimativa de tokens atual:\n${this.getTokenEstimate()}`);
        return;
      }
      
      if (commandText === "/help") {
        onText("🛠️ **Comandos Disponíveis no Koda:**\n\n- `/clear` ou `/reset`: Limpa o histórico atual de conversa e a memória do agente\n- `/tokens` ou `/cost`: Exibe uma estimativa de uso e custo dos tokens LLM\n- `/help`: Exibe este menu de ajuda\n\n*(Qualquer outro texto que não inicie com '/' será enviado normalmente à IA)*");
        return;
      }
      
      onText(`⚠️ Comando desconhecido: \`${commandText}\`\nDigite \`/help\` para ver a lista de comandos disponíveis.`);
      return;
    }

    this.isProcessing = true;

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

      while (iterations < MAX_TOOL_ITERATIONS) {
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

      if (iterations >= MAX_TOOL_ITERATIONS) {
        onError(
          `⚠️ Reached maximum tool iterations (${MAX_TOOL_ITERATIONS}). Stopping.`
        );
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

  getTokenEstimate(): string {
    return this.conversation.getFormattedTokenCount();
  }
}
