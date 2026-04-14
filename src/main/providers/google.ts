import {
  GoogleGenerativeAI,
  SchemaType,
  Content,
  Part,
  FunctionDeclaration,
  FunctionDeclarationSchema,
  FunctionDeclarationSchemaProperty,
} from "@google/generative-ai";
import { BaseProvider, Message, StreamChunk } from "./base.js";
import { ToolRegistry } from "../tools/index.js";

export class GoogleProvider extends BaseProvider {
  private client: GoogleGenerativeAI;

  constructor(
    model: string,
    apiKey: string,
    maxTokens: number,
    temperature: number
  ) {
    super(model, apiKey, maxTokens, temperature);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  get providerName() {
    return "Google";
  }

  async *chat(
    messages: Message[],
    tools: ToolRegistry
  ): AsyncGenerator<StreamChunk> {
    const rawSystem = messages.find((m) => m.role === "system")?.content;
    const systemMessage = Array.isArray(rawSystem) ? "" : (rawSystem || "");
    const geminiContents = this.convertMessages(
      messages.filter((m) => m.role !== "system")
    );

    const geminiTools = tools.toGoogleTools();
    const functionDeclarations: FunctionDeclaration[] = geminiTools.map(
      (t) => {
        const properties: Record<string, FunctionDeclarationSchemaProperty> = {};
        const rawProps = t.parameters.properties as Record<
          string,
          { type: string; description: string }
        >;

        for (const [key, value] of Object.entries(rawProps)) {
          const type =
            value.type === "NUMBER"
              ? SchemaType.NUMBER
              : value.type === "BOOLEAN"
                ? SchemaType.BOOLEAN
                : value.type === "ARRAY"
                  ? SchemaType.ARRAY
                  : SchemaType.STRING;

          properties[key] = {
            type,
            description: value.description,
            ...(type === SchemaType.ARRAY
              ? { items: { type: SchemaType.STRING } }
              : {}),
          } as FunctionDeclarationSchemaProperty;
        }

        const schema: FunctionDeclarationSchema = {
          type: SchemaType.OBJECT,
          properties,
          required: t.parameters.required as string[],
        };

        return {
          name: t.name,
          description: t.description,
          parameters: schema,
        };
      }
    );

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemMessage,
        tools: [{ functionDeclarations }],
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature,
        },
      });

      const result = await model.generateContentStream({
        contents: geminiContents,
      });

      for await (const chunk of result.stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate?.content?.parts) continue;

        for (const part of candidate.content.parts) {
          if ((part as any).thought) {
            yield { type: "thought", content: (part as any).thought, thoughtData: part };
          }
          if (part.text) {
            yield { type: "text", content: part.text };
          }

          if (part.functionCall) {
            const toolCallId = `google_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            yield {
              type: "tool_call_start",
              toolCall: {
                id: toolCallId,
                name: part.functionCall.name,
              },
            };
            yield {
              type: "tool_call_end",
              toolCall: {
                id: toolCallId,
                name: part.functionCall.name,
                arguments: (part.functionCall.args || {}) as Record<string, unknown>,
                _rawPart: part, // preserve thought_signature and any other fields
              },
            };
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

  private convertMessages(messages: Message[]): Content[] {
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === "assistant") {
        const parts: Part[] = [];
        
        if (msg.thought) {
          // If thought is an object (part), add it. If it's an array, add all.
          if (Array.isArray(msg.thought)) {
            parts.push(...msg.thought);
          } else if (typeof msg.thought === 'object') {
            parts.push(msg.thought);
          } else {
            parts.push({ thought: msg.thought } as any);
          }
        }

        if (msg.content && !Array.isArray(msg.content)) {
          parts.push({ text: msg.content });
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            if (tc._rawPart) {
              // Use the original part verbatim to preserve thought_signature
              parts.push(tc._rawPart as Part);
            } else {
              parts.push({
                functionCall: {
                  name: tc.name,
                  args: tc.arguments,
                },
              } as any);
            }
          }
        }

        contents.push({ role: "model", parts });
      } else if (msg.role === "tool") {
        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: msg.toolCallId || "unknown",
                response: { result: msg.content },
              },
            },
          ],
        });
      } else {
        // User message — may be rich multimodal
        if (Array.isArray(msg.content)) {
          const parts: Part[] = msg.content.map(part => {
            if (part.type === "image" && part.image) {
              const base64data = part.image.dataUrl.split(",")[1] || "";
              return {
                inlineData: {
                  mimeType: part.image.mimeType,
                  data: base64data,
                },
              } as Part;
            }
            return { text: part.text || "" } as Part;
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
