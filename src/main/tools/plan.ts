import { BaseTool, ToolParameter, ToolResult } from "./base.js";
import { BrowserWindow } from "electron";
import { writeFile } from "fs/promises";
import { resolve } from "path";

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
This tool transitions you into Spec Development mode where you can explore the codebase and draft a specifications file (specs.md) on the workspace.

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

Remember: In Spec Development mode, you may ONLY write or edit the "specs.md" file in the root of the project. No other file edits are allowed until the spec is approved.`;

  parameters: ToolParameter[] = [];

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    if (state.mode === "plan") {
      return this.success("Already in Spec Development mode. Explore the codebase and write your specifications to specs.md in the root directory. When ready, call exit_plan_mode.");
    }

    state.mode = "plan";
    state.currentPlan = null;

    emitPlanState("plan_mode_entered");

    return this.success(
      `Entered Spec Development mode.\n\nIn this mode, you should:\n1. Thoroughly explore the codebase to understand existing patterns\n2. Design your implementation strategy\n3. Write your specifications into a "specs.md" file in the root directory\n4. When ready, call exit_plan_mode to present your plan for approval`
    );
  }
}

// ─── ExitPlanMode Tool ─────────────────────────────────────────────────────────

export class ExitPlanModeTool extends BaseTool {
  name = "exit_plan_mode";
  description = `Use this tool when you are in Spec Development mode and have finished writing the specifications to "specs.md" and are ready for user approval.

## How This Tool Works
- Write the complete plan/specs as the 'plan' parameter. If approved, it will be automatically written to "specs.md" in the root directory.
- The user will review and either APPROVE (you can start coding) or REJECT (refine your approach)
- If rejected, you stay in Spec Development mode and should refine your specs.md

Only use this tool when planning the implementation steps of a coding task — NOT for research tasks.`;

  parameters: ToolParameter[] = [
    {
      name: "plan",
      type: "string",
      description: "The complete implementation specifications in Markdown. This content will be written to specs.md upon approval.",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    if (state.mode !== "plan") {
      return this.failure(
        "You are not in Spec Development mode. This tool is only for exiting Spec Development mode after writing specifications. If you want to plan first, call enter_plan_mode."
      );
    }

    const plan = args.plan as string;
    if (!plan || plan.trim() === "") {
      return this.failure("Plan/Specification content cannot be empty. Write your specifications first.");
    }

    state.currentPlan = plan;

    // Emit to renderer and wait for user response
    emitPlanState("plan_approval_requested", { plan });

    // Wait for user to approve or reject via IPC
    const approved = await new Promise<boolean>((resolve) => {
      state.pendingApproval = { resolve };
    });

    if (approved) {
      try {
        const specsPath = resolve(process.cwd(), "specs.md");
        await writeFile(specsPath, plan, "utf-8");
        
        state.mode = "normal";
        state.currentPlan = null;
        emitPlanState("plan_mode_exited", { approved: true });

        return this.success(
          `User has approved your specification. It has been successfully written to ${specsPath}. You can now start coding!\n\n## Approved Specs:\n${plan}`
        );
      } catch (err) {
        return this.failure(`Plan approved but failed to write specs.md: ${(err as Error).message}`);
      }
    } else {
      // Stay in Spec Development mode
      emitPlanState("plan_mode_exited", { approved: false });
      return this.failure(
        `User rejected the specifications. Stay in Spec Development mode, refine your specifications in specs.md, and call exit_plan_mode again.`
      );
    }
  }
}
