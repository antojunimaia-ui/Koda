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
import { FireworksProvider } from "../providers/fireworks.js";
import { ZhipuProvider } from "../providers/zhipu.js";
import { MaritacaProvider } from "../providers/maritaca.js";
import { KodaCloudProvider } from "../providers/koda-cloud.js";
import { mcpManager } from "../services/mcp-manager.js";
import { MCPTool } from "../tools/mcp-tool.js";
import { skillManager } from "../services/skill-manager.js";
import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';



export class Agent {
  private provider: BaseProvider | null = null;
  private tools: ToolRegistry;
  private conversation: Conversation;
  private settings: AppSettings;
  private projectContext: ProjectContext | null = null;
  private isProcessing = false;
  private dynamicSystemPrompt: string;
  private abortController: AbortController | null = null;

  constructor() {
    this.settings = getSettings();
    this.tools = new ToolRegistry(this.settings);
    
    // Build initial system prompt (without project rules - those load in initialize)
    this.dynamicSystemPrompt = PromptBuilder.build(this.settings.systemPrompt);
    this.conversation = new Conversation(this.dynamicSystemPrompt);
  }

  private async createProviderAsync(): Promise<BaseProvider> {
    const { provider: rawProvider, model, apiKey, maxTokens, temperature } = this.settings;
    const provider = String(rawProvider || "openai").toLowerCase();

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
      case "fireworks":
        return new FireworksProvider(model, apiKey, maxTokens, temperature);
      case "zhipu":
        return new ZhipuProvider(model, apiKey, maxTokens, temperature);
      case "maritaca":
        return new MaritacaProvider(model, apiKey, maxTokens, temperature);
      case "koda-cloud":
        return new KodaCloudProvider(model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async initialize(): Promise<void> {
    // 1. Priority: Create provider and set it immediately so the agent is functional
    this.provider = await this.createProviderAsync();

    // 2. Secondary: Gather project context (might be slow)
    this.projectContext = await gatherProjectContext();

    // 3. Load MCP Tools
    await this.reloadMcpTools();

    // 4. Update system prompt with new context and tools
    await this.rebuildPrompt();

    // 5. Inject project context: handled via System Prompt in rebuildPrompt()
  }

  getInfo(): {
    providerId: string;
    provider: string;
    model: string;
    advisorModel: string;
    project: string;
    cwd: string;
  } {
    return {
      providerId: this.settings.provider,
      provider: this.provider?.providerName ?? this.settings.provider,
      model: this.settings.model,
      advisorModel: this.settings.advisorModel,
      project: this.projectContext?.name ?? "...",
      cwd: process.cwd(),
    };
  }

  async processMessage(
    userMessage: string,
    onText: (text: string) => void,
    onToolStart: (name: string, args: any) => void,
    onToolProgress: (name: string, chunk: string) => void,
    onToolEnd: (name: string, result: string, success: boolean, args: any) => void,
    onError: (error: string) => void,
    images?: import("../providers/base.js").ContentPart[]
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
        await this.resetConversation();
        onText("✨ Conversation memory cleared. Starting fresh!");
        return;
      }
      
      if (commandText === "/tokens" || commandText === "/cost") {
        onText(`📊 Current token estimate:\n${this.getTokenEstimate()}`);
        return;
      }
      
      if (commandText === "/help") {
        const allSkills = await skillManager.getAll();
        const skillList = allSkills.length > 0
          ? '\n\n**Skills:**\n' + allSkills.map(s => `- \`/${s.name}\`${s.description ? ` — ${s.description}` : ''}`).join('\n')
          : '';
        onText(`🛠️ **Available Koda Commands:**\n\n- \`/clear\` or \`/reset\`: Clears current conversation history and agent memory\n- \`/tokens\` or \`/cost\`: Displays an estimate of LLM token usage and cost\n- \`/help\`: Displays this help menu\n- \`/<skill-name> [message]\`: Activates a skill and optionally sends a message${skillList}\n\n*Tip: Click on the **PATH** display in the header to change your working directory natively.*`);
        return;
      }

      // Skill invocation: /skill-name [optional message]
      const slashParts = userMessage.trim().split(/\s+/);
      const skillName = slashParts[0].slice(1); // remove leading /
      const skill = await skillManager.getByName(skillName);
      if (skill) {
        const restOfMessage = slashParts.slice(1).join(' ').trim();
        const skillContext = `[SKILL ACTIVATED: ${skill.name}]\n\n${skill.content}`;
        if (restOfMessage) {
          // Skill + message: re-enter with enriched message (no longer a slash command)
          this.isProcessing = false;
          const enriched = `${skillContext}\n\n---\n\n${restOfMessage}`;
          return this.processMessage(enriched, onText, onToolStart, onToolProgress, onToolEnd, onError, images);
        } else {
          // Skill only: acknowledge and inject into conversation context
          onText(`✅ Skill **${skill.name}** activated.${skill.description ? ` ${skill.description}` : ''}\n\nSend your task and I'll apply this skill's instructions.`);
          this.conversation.addUser(`[SKILL CONTEXT - apply these instructions to all subsequent tasks]\n\n${skillContext}`);
          this.conversation.addAssistant(`Skill **${skill.name}** loaded. I'll apply its instructions to your tasks.`);
          return;
        }
      }

      onText(`⚠️ Unknown command: \`${commandText}\`\nType \`/help\` to see the list of available commands.`);
      return;
    }

    this.isProcessing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Detect Mode from the message wrapper generated by the UI
    const isPlannerMode = userMessage.includes("[SPEC DEVELOPMENT MODE PROTOCOL - MANDATORY]");
    const isColabMode = userMessage.includes("[COLLABORATIVE MODE PROTOCOL - ACTIVE]");
    
    if (isColabMode) {
      this.tools.setActiveMode("colab");
    } else {
      this.tools.setActiveMode(isPlannerMode ? "planner" : "fast");
    }

    try {
      // Expand @-mentions in the user message
      let enrichedMessage = userMessage;
      const mentionRegex = /@\[(.*?)\]/g;
      let match;
      const mentions = new Set<string>();
      
      while ((match = mentionRegex.exec(userMessage)) !== null) {
        mentions.add(match[1]);
      }

      for (const filePath of mentions) {
        try {
          const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
          const stats = await fs.stat(absPath);
          if (stats.isFile()) {
            // Limit file size to 50KB for mentions to avoid PayloadTooLarge errors
            if (stats.size > 50 * 1024) {
              enrichedMessage = enrichedMessage.replace(`@[${filePath}]`, `@[${filePath}] (File too large to include full content: ${Math.round(stats.size/1024)}KB)`);
            } else {
              const content = await fs.readFile(absPath, 'utf-8');
              const language = path.extname(filePath).slice(1) || 'text';
              enrichedMessage = enrichedMessage.replace(`@[${filePath}]`, `\n--- FILE: ${filePath} ---\n\`\`\`${language}\n${content}\n\`\`\`\n`);
            }
          }
        } catch (err) {
          console.warn(`Failed to expand mention @[${filePath}]:`, err);
        }
      }

      // Add context to first user message
      let messageToSend = enrichedMessage;
      if (
        this.conversation.getMessageCount() <= 1 &&
        this.projectContext?.summary
      ) {
        messageToSend = `[Project Context]\n${this.projectContext.summary}\n\n[User Message]\n${enrichedMessage}`;
      }


      this.conversation.addUser(messageToSend, images);

      let iterations = 0;

      while (true) {
        iterations++;

        if (signal.aborted) break;

        // Trim context if needed
        this.conversation.trimIfNeeded();

        const messages = this.conversation.getMessages();
        let assistantText = "";
        let assistantThoughts: any[] = [];
        const pendingToolCalls: ToolCall[] = [];
        let hasToolCalls = false;
        let currentStreamingToolName = "";

        // Tool results collected during streaming (executed eagerly on tool_call_end)
        const toolResults: { id: string; name: string; output: string; success: boolean }[] = [];

        // Stream response from LLM
        for await (const chunk of this.provider.chat(
          messages,
          this.tools
        )) {
          if (signal.aborted) break;

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
                currentStreamingToolName = chunk.toolCall.name;
                onToolStart(chunk.toolCall.name, chunk.toolCall.arguments);
              }
              break;

            case "tool_call_args":
              if (currentStreamingToolName && chunk.content) {
                onToolProgress(currentStreamingToolName, chunk.content);
              }
              break;

            case "tool_call_end":
              if (chunk.toolCall?.name && chunk.toolCall?.id) {
                currentStreamingToolName = "";
                const toolCall = chunk.toolCall as ToolCall;
                pendingToolCalls.push(toolCall);

                if (signal.aborted) break;

                // Execute the tool immediately — don't wait for the stream to finish.
                const result = await this.tools.execute(toolCall.name, toolCall.arguments);
                const success = result.success;
                const output = result.error || result.output;
                onToolEnd(toolCall.name, output, success, toolCall.arguments);
                toolResults.push({ id: toolCall.id, name: toolCall.name, output, success });
              }
              break;

            case "error":
              onError(chunk.error || "Unknown error");
              break;

            case "done":
              break;
          }
        }

        if (signal.aborted) break;

        // Save assistant message
        this.conversation.addAssistant(
          assistantText,
          hasToolCalls ? pendingToolCalls : undefined,
          assistantThoughts.length > 0 ? assistantThoughts : undefined
        );

        // Add all tool results to conversation (collected during streaming)
        if (toolResults.length > 0) {
          for (const tr of toolResults) {
            this.conversation.addToolResult(
              tr.id,
              tr.success ? tr.output : `Error: ${tr.output}`,
              tr.name
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
      this.abortController = null;
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  async setApiKey(key: string): Promise<void> {
    this.settings.apiKey = key;
    this.provider = await this.createProviderAsync();
  }

  async setModel(model: string): Promise<void> {
    this.settings.model = model;

    // Detect provider from model name
    if (model.includes("accounts/fireworks/")) {
      this.settings.provider = "fireworks";
    } else if (model.includes("/")) {
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
    } else if (model.includes("cloud") || model.includes("koda-cloud")) {
      this.settings.provider = "koda-cloud";
    }

    this.provider = await this.createProviderAsync();
  }

  async updateSettings(updates: { provider?: any, model?: string, advisorModel?: string, apiKey?: string }): Promise<void> {
    if (updates.provider) this.settings.provider = String(updates.provider).toLowerCase() as any;
    if (updates.model) this.settings.model = updates.model;
    if (updates.advisorModel) this.settings.advisorModel = updates.advisorModel;
    if (updates.apiKey !== undefined) this.settings.apiKey = updates.apiKey;
    
    this.provider = await this.createProviderAsync();
  }

  async resetConversation(): Promise<void> {
    // 1. Rebuild the system prompt to ensure it has latest context/mcp tools
    await this.rebuildPrompt();
    // 2. Clear history (Conversation.clear preserves the system message)
    this.conversation.clear();
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

  setProgressEmitter(fn: (event: string, toolName: string, data?: Record<string, unknown>) => void): void {
    this.tools.setProgressEmitter(fn);
  }

  public async reloadMcpTools(): Promise<void> {
    try {
      const configPath = path.join(app.getPath('userData'), 'mcp-configs.json');
      try {
        await fs.access(configPath);
      } catch {
        return;
      }

      const data = await fs.readFile(configPath, 'utf-8');
      const configs: any[] = JSON.parse(data);

      this.tools.clearNonCoreTools();
      await mcpManager.stopAll();

      for (const config of configs) {
        if (!config.enabled) continue;
        const mcpTools = await mcpManager.loadServerTools(config);
        for (const tool of mcpTools) {
          this.tools.registerDynamic(new MCPTool(
            tool.name,
            tool.description,
            (tool.inputSchema.properties ? Object.entries(tool.inputSchema.properties).map(([name, schema]: [string, any]) => ({
              name,
              type: schema.type === 'number' ? 'number' : schema.type === 'boolean' ? 'boolean' : schema.type === 'array' ? 'array' : 'string',
              description: schema.description || '',
              required: tool.inputSchema.required?.includes(name) || false
            })) : []),
            config.id,
            (serverId, toolName, args) => mcpManager.callTool(serverId, toolName, args)
          ));
        }
      }

      // Rebuild system prompt to include new tools awareness
      await this.rebuildPrompt();
    } catch (err) {
      console.error('[Agent] Failed to load MCP tools:', err);
    }
  }

  private getToolsMetadata(): string {
    return this.tools.getAll()
      .map(t => `- **${t.name}**: ${t.description}`)
      .join('\n');
  }

  private async rebuildPrompt(): Promise<void> {
    // Load project rules from .agents/rules.md if trigger: always_on
    const { rulesManager } = await import('../services/rules-manager.js');
    const projectRules = await rulesManager.getContent(process.cwd());
    
    this.dynamicSystemPrompt = PromptBuilder.build(
      this.settings.systemPrompt,
      { 
        workspaceName: this.projectContext?.name,
        projectSummary: this.projectContext?.summary,
        projectRules: projectRules || undefined,
        toolsMetadata: this.getToolsMetadata()
      }
    );
    
    if (this.conversation) {
      this.conversation.updateSystemPrompt(this.dynamicSystemPrompt);
    } else {
      this.conversation = new Conversation(this.dynamicSystemPrompt);
    }
  }

  getHistory(): any[] {
    return this.conversation.getMessages();
  }

  setHistory(messages: any[]): void {
    this.conversation.setMessages(messages);
  }
}
