import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { OpenAIProvider } from "../providers/openai.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { GoogleProvider } from "../providers/google.js";
import { OpenRouterProvider } from "../providers/openrouter.js";
import { OllamaProvider } from "../providers/ollama.js";
import { OpenCodeZenProvider } from "../providers/opencode-zen.js";
import { AppSettings } from "../config/settings.js";

// Global state for the active collaboration session
let advisorConversation: any[] = [];
let advisorProviderCache: any = null;

const dummyTools = {
  toOpenAITools: () => [],
  toAnthropicTools: () => [],
  toGoogleTools: () => []
};

export class StartColabTool extends BaseTool {
  name = "start_collaboration";
  description = "Start a multi-turn conversation with an Elite Technical Advisor. Use this when you need deep brainstorming. You must call 'send_to_advisor' after this to talk.";
  parameters: ToolParameter[] = [
    {
      name: "context",
      type: "string",
      description: "The initial problem or architectural context to set the stage for the advisor.",
      required: true,
    }
  ];

  private settings: AppSettings;
  constructor(settings: AppSettings) { super(); this.settings = settings; }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const context = args.context as string;
    const { provider: providerType, advisorModel, apiKey, maxTokens, temperature } = this.settings;

    advisorConversation = [
      {
        role: "system",
        content: "You are an Elite Technical Advisor. You are in a collaboration session with Koda, the main agent. Be surgical, offer superior architectural advice, and keep the discussion high-level and focused on technical excellence."
      },
      {
        role: "user",
        content: `Koda Session Started. Context: ${context}`
      }
    ];

    // Initialize provider
    switch (providerType) {
      case "openai": advisorProviderCache = new OpenAIProvider(advisorModel, apiKey, maxTokens, temperature); break;
      case "anthropic": advisorProviderCache = new AnthropicProvider(advisorModel, apiKey, maxTokens, temperature); break;
      case "google": advisorProviderCache = new GoogleProvider(advisorModel, apiKey, maxTokens, temperature); break;
      case "openrouter": advisorProviderCache = new OpenRouterProvider(advisorModel, apiKey, maxTokens, temperature); break;
      case "ollama": advisorProviderCache = new OllamaProvider(advisorModel, apiKey, maxTokens, temperature); break;
      case "opencode-zen": advisorProviderCache = new OpenCodeZenProvider(advisorModel, apiKey, maxTokens, temperature); break;
      default: return this.failure(`Provider ${providerType} not supported for colab.`);
    }

    return this.success(`🤝 Collaboration session started with ${advisorModel}. You can now use 'send_to_advisor' to brainstorm.`);
  }
}

export class SendColabTool extends BaseTool {
  name = "send_to_advisor";
  description = "Send a message to the active advisor and get their feedback. Requires an active session started with 'start_collaboration'.";
  parameters: ToolParameter[] = [
    {
      name: "message",
      type: "string",
      description: "Your message or follow-up question to the advisor.",
      required: true,
    }
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    if (!advisorProviderCache) return this.failure("No active collaboration session. Call 'start_collaboration' first.");
    
    const message = args.message as string;
    advisorConversation.push({ role: "user", content: message });

    try {
      let response = "";
      for await (const chunk of advisorProviderCache.chat(advisorConversation, dummyTools as any)) {
        if (chunk.type === "text") response += chunk.content;
      }

      advisorConversation.push({ role: "assistant", content: response });
      return this.success(`### ADVISOR FEEDBACK\n\n${response}`);
    } catch (err) {
      return this.failure(`Advisor failed to respond: ${(err as Error).message}`);
    }
  }
}

export class EndColabTool extends BaseTool {
  name = "end_collaboration";
  description = "Terminate the active collaboration session and consolidate the advice received. Use this once you have a clear path forward.";
  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    advisorConversation = [];
    advisorProviderCache = null;
    return this.success("🏁 Collaboration session terminated. You can now proceed with the implementation using the advice gathered.");
  }
}
