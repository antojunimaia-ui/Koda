import { BaseTool, ToolResult } from "./base.js";
import { skillManager } from "../services/skill-manager.js";

/**
 * Tool that allows the agent to load a skill by name and inject its instructions.
 * The agent can call this autonomously when it detects a task that matches a skill.
 */
export class LoadSkillTool extends BaseTool {
  name = "load_skill";
  description =
    "Loads a skill by name and returns its instructions to enhance your capabilities for a specific domain. " +
    "Use this when you detect the task requires specialized knowledge (e.g. react-expert, git-workflow, api-design). " +
    "After loading, apply the skill's instructions to your current task.";

  parameters = [
    {
      name: "skill_name",
      type: "string" as const,
      description: "The name of the skill to load (e.g. 'react-expert', 'git-workflow')",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const err = this.validateArgs(args);
    if (err) return this.failure(err);

    const skillName = args.skill_name as string;
    const skill = await skillManager.getByName(skillName);

    if (!skill) {
      const all = await skillManager.getAll();
      const available = all.map(s => s.name).join(', ') || 'none';
      return this.failure(
        `Skill "${skillName}" not found. Available skills: ${available}`
      );
    }

    return this.success(
      `# Skill Loaded: ${skill.name}\n\n${skill.description ? `> ${skill.description}\n\n` : ''}${skill.content}`
    );
  }
}
