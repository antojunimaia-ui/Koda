import { Message, ContentPart } from "../providers/base.js";
import { estimateTokens, formatTokenCount } from "../utils/tokens.js";

export class Conversation {
  private messages: Message[] = [];
  private maxContextTokens: number;

  constructor(systemPrompt: string, maxContextTokens = 100_000) {
    this.maxContextTokens = maxContextTokens;
    this.messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  updateSystemPrompt(newPrompt: string): void {
    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.messages[0].content = newPrompt;
    } else {
      this.messages.unshift({ role: "system", content: newPrompt });
    }
  }

  addUser(content: string, images?: ContentPart[]): void {
    if (images && images.length > 0) {
      const parts: ContentPart[] = [
        { type: "text", text: content },
        ...images,
      ];
      this.messages.push({ role: "user", content: parts });
    } else {
      this.messages.push({ role: "user", content });
    }
  }

  addAssistant(
    content: string,
    toolCalls?: Message["toolCalls"],
    thought?: any
  ): void {
    this.messages.push({
      role: "assistant",
      content,
      thought,
      toolCalls,
    });
  }

  addToolResult(toolCallId: string, content: string, toolName?: string): void {
    this.messages.push({
      role: "tool",
      content,
      toolCallId,
      toolName,
    });
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getTokenEstimate(): number {
    return estimateTokens(
      this.messages.map((m) => m.content).join("\n")
    );
  }

  getFormattedTokenCount(): string {
    return formatTokenCount(this.getTokenEstimate());
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * MicroCompact: Clears out old, heavy tool results (like logs and file contents)
   * that the model has already read and digested, keeping only the most recent N turns.
   */
  microCompact(keepRecentAssistantTurns = 2): boolean {
    let compacted = false;
    const compactableTools = new Set([
      "bash_command", "read_file", "search_directory", "fetch_url",
      "lsp_query", "list_directory", "read_browser_page"
    ]);

    let assistantCount = 0;
    
    // Travel from the newest messages to the oldest
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role === "assistant") {
        assistantCount++;
      }
      
      // If this tool result is older than the kept turns
      if (assistantCount > keepRecentAssistantTurns) {
        if (msg.role === "tool" && msg.toolCallId) {
          // Identify tool name by looking backwards for the assistant message that spawned it
          let toolName = "unknown";
          for (let j = i - 1; j >= 0; j--) {
            const prevMsg = this.messages[j];
            if (prevMsg.role === "assistant" && prevMsg.toolCalls) {
              const call = prevMsg.toolCalls.find((c) => c.id === msg.toolCallId);
              if (call) {
                toolName = call.name;
                break;
              }
            }
          }

          const clearanceNotice = "[Tool output compacted to save context memory]";
          if (compactableTools.has(toolName) && msg.content !== clearanceNotice) {
            // Check length to see if it's worth compacting
            if (msg.content.length > 100) {
                msg.content = clearanceNotice;
                compacted = true;
            }
          }
        }
      }
    }
    return compacted;
  }

  /**
   * Trim old messages to stay within token limits,
   * always preserving the system message and the last N messages
   */
  trimIfNeeded(preserveLastN = 10): boolean {
    this.microCompact(2); // Always run microCompact before trimming

    const estimate = this.getTokenEstimate();
    if (estimate <= this.maxContextTokens) return false;

    const system = this.messages[0];
    const recent = this.messages.slice(-preserveLastN);

    // Create a summary of trimmed messages
    const trimmedCount = this.messages.length - 1 - preserveLastN;
    const summaryMsg: Message = {
      role: "user",
      content: `[Context note: ${trimmedCount} earlier messages were trimmed to fit context window. The conversation continues from the recent messages below.]`,
    };

    this.messages = [system, summaryMsg, ...recent];
    return true;
  }

  clear(): void {
    const system = this.messages[0];
    this.messages = [system];
  }

  /**
   * Truncates the conversation history to the given length.
   * Used during a Snapshot Rollback to restore agent memory.
   */
  truncateToLength(length: number): void {
    if (length < 1) {
      this.clear();
    } else {
      this.messages = this.messages.slice(0, length);
    }
  }

  setMessages(messages: Message[]): void {
    this.messages = [...messages];
  }
}
