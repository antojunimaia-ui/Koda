import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { BrowserWindow } from "electron";

// ─── Shared Plan State (singleton per session) ────────────────────────────────

export type PlanMode = "normal" | "plan";

interface PlanState {
  mode: PlanMode;
  currentPlan: string | null;
  // Promise resolve/reject — set when ExitPlanMode is waiting for user approval
  pendingApproval: {
    resolve: (approved: boolean) => void;
  } | null;
}

const state: PlanState = {
  mode: "normal",
  currentPlan: null,
  pendingApproval: null,
};

export function getPlanMode(): PlanMode {
  return state.mode;
}

export function getPlanModeState() {
  return { ...state };
}

/** Called by the IPC handler when user clicks Approve or Reject in the UI */
export function resolvePlanApproval(approved: boolean) {
  if (state.pendingApproval) {
    state.pendingApproval.resolve(approved);
    state.pendingApproval = null;
  }
}

// Emit plan mode state changes to the renderer
function emitPlanState(type: string, payload: Record<string, unknown> = {}) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send("agent:update", { type, ...payload });
  }
}

// ─── EnterPlanMode Tool ────────────────────────────────────────────────────────

export class EnterPlanModeTool extends BaseTool {
  name = "enter_plan_mode";
  description = `Use this tool proactively when you're about to start a non-trivial implementation task.
Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment.
This tool transitions you into plan mode where you can explore the codebase and design an implementation approach.

## When to Use This Tool
Use it when ANY of these conditions apply:
1. New Feature Implementation requiring architectural decisions
2. Multiple Valid Approaches exist (Redis vs in-memory, WebSockets vs polling, etc.)
3. Code Modifications that affect existing behavior or structure
4. Multi-File Changes touching more than 2-3 files
5. Unclear Requirements — need to explore before understanding full scope

## When NOT to Use
- Single-line or few-line fixes (typos, obvious bugs)
- Tasks where the user gave very specific, detailed instructions
- Pure research/exploration tasks

Remember: DO NOT write or edit any files in plan mode. This is a read-only exploration and planning phase.`;

  parameters: ToolParameter[] = [];

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    if (state.mode === "plan") {
      return this.success("Already in plan mode. Explore the codebase and design your approach. When ready, call exit_plan_mode with your plan.");
    }

    state.mode = "plan";
    state.currentPlan = null;

    emitPlanState("plan_mode_entered");

    return this.success(
      `Entered plan mode.\n\nIn plan mode, you should:\n1. Thoroughly explore the codebase to understand existing patterns\n2. Identify similar features and architectural approaches\n3. Consider multiple approaches and their trade-offs\n4. Design a concrete implementation strategy\n5. When ready, use exit_plan_mode to present your plan for approval\n\nRemember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.`
    );
  }
}

// ─── ExitPlanMode Tool ─────────────────────────────────────────────────────────

export class ExitPlanModeTool extends BaseTool {
  name = "exit_plan_mode";
  description = `Use this tool when you are in plan mode and have finished designing your implementation approach and are ready for user approval.

## How This Tool Works
- Write your complete plan as the 'plan' parameter
- The user will review and either APPROVE (you can start coding) or REJECT (refine your approach)
- If rejected, you stay in plan mode and should refine your plan

## Before Using This Tool
Ensure your plan is complete and unambiguous:
- List every file you will create or modify
- Describe the approach for each change
- Note any dependencies or trade-offs

Only use this tool when planning the implementation steps of a coding task — NOT for research tasks.`;

  parameters: ToolParameter[] = [
    {
      name: "plan",
      type: "string",
      description: "The complete implementation plan in Markdown. Must include: what you will do, which files will be touched, and why you chose this approach.",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    if (state.mode !== "plan") {
      return this.failure(
        "You are not in plan mode. This tool is only for exiting plan mode after writing a plan. If you want to plan first, call enter_plan_mode."
      );
    }

    const plan = args.plan as string;
    if (!plan || plan.trim() === "") {
      return this.failure("Plan cannot be empty. Write a complete implementation plan before calling exit_plan_mode.");
    }

    state.currentPlan = plan;

    // Emit to renderer and wait for user response
    emitPlanState("plan_approval_requested", { plan });

    // Wait for user to approve or reject via IPC
    const approved = await new Promise<boolean>((resolve) => {
      state.pendingApproval = { resolve };
    });

    if (approved) {
      state.mode = "normal";
      state.currentPlan = null;
      emitPlanState("plan_mode_exited", { approved: true });

      return this.success(
        `User has approved your plan. You can now start coding.\n\n## Approved Plan:\n${plan}`
      );
    } else {
      // Stay in plan mode
      emitPlanState("plan_mode_exited", { approved: false });
      return this.failure(
        `User rejected the plan. Stay in plan mode, refine your approach based on their feedback, and call exit_plan_mode again with an improved plan.`
      );
    }
  }
}
