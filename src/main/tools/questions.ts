import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { BrowserWindow } from "electron";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  header: string;
  multiple: boolean;
  question: string;
  options: QuestionOption[];
}

export interface QuestionsPayload {
  questions: Question[];
}

export interface QuestionAnswer {
  index: number;
  question: string;
  selected: string[];
}

// ─── Shared State ─────────────────────────────────────────────────────────────

interface QuestionsState {
  pendingAnswers: {
    resolve: (answers: QuestionAnswer[]) => void;
  } | null;
}

const state: QuestionsState = {
  pendingAnswers: null,
};

/** Called by the IPC handler when the user submits all answers */
export function resolveQuestions(answers: QuestionAnswer[]) {
  if (state.pendingAnswers) {
    state.pendingAnswers.resolve(answers);
    state.pendingAnswers = null;
  }
}

function emitQuestionsEvent(type: string, payload: Record<string, unknown> = {}) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send("agent:update", { type, ...payload });
  }
}

// ─── Questions Tool ────────────────────────────────────────────────────────────

export class QuestionsTool extends BaseTool {
  name = "questions";
  description = `Use this tool to ask the user clarifying questions before proceeding with a task.
Call this when the user's request is ambiguous and you need specific information to act correctly.

## When to Use
- Multiple valid implementation approaches exist and the choice significantly affects the outcome
- Missing required configuration details (e.g., which framework, database, auth strategy)
- The user's intent is unclear and guessing wrong would waste significant effort

## When NOT to Use
- Simple tasks where you can make a reasonable default decision
- When you already have enough context to proceed
- For trivial preferences that don't affect the outcome

## Rules
- Maximum 10 questions per call
- Each question must have between 2 and 5 options
- Keep headers short (max 30 characters)
- Make options mutually exclusive when multiple=false
- Use multiple=true only when combining options makes sense

The tool will block until the user answers all questions, then return their selections.`;

  parameters: ToolParameter[] = [
    {
      name: "questions",
      type: "array",
      description: `Array of question objects. Each object must have:
- header (string, max 30 chars): short label shown at the top
- multiple (boolean): whether the user can select more than one option
- question (string): the full question text shown to the user
- options (array of {label, description}): 2–5 choices`,
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const rawQuestions = args.questions as Question[] | undefined;

    if (!rawQuestions || !Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return this.failure("'questions' must be a non-empty array.");
    }

    if (rawQuestions.length > 10) {
      return this.failure("Maximum of 10 questions allowed per call.");
    }

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      if (!q.question || typeof q.question !== "string") {
        return this.failure(`Question at index ${i} is missing the 'question' field.`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) {
        return this.failure(`Question at index ${i} must have between 2 and 5 options.`);
      }
      if (q.header && q.header.length > 30) {
        return this.failure(`Question at index ${i}: 'header' must be 30 characters or fewer.`);
      }
    }

    // Emit to renderer and wait for user answers
    emitQuestionsEvent("questions_requested", { questions: rawQuestions });

    const answers = await new Promise<QuestionAnswer[]>((resolve) => {
      state.pendingAnswers = { resolve };
    });

    // Format answers as a readable summary for the LLM
    const summary = answers
      .map((a) => `Q: ${a.question}\nA: ${a.selected.join(", ")}`)
      .join("\n\n");

    return this.success(
      `User answered all questions:\n\n${summary}\n\n---\nRaw answers:\n${JSON.stringify(answers, null, 2)}`
    );
  }
}
