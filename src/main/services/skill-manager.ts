import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface SkillMeta {
  name: string;
  description: string;
  triggers: string[];
  version?: string;
}

export interface Skill extends SkillMeta {
  content: string; // full markdown body (without front-matter)
  filePath: string;
}

/**
 * Parses YAML-like front-matter from a markdown file.
 * Supports: name, description, triggers (array or inline)
 */
function parseFrontMatter(raw: string): { meta: Partial<SkillMeta>; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { meta: {}, body: raw };

  const fmBlock = fmMatch[1];
  const body = fmMatch[2].trim();
  const meta: Partial<SkillMeta> = {};

  // name
  const nameMatch = fmBlock.match(/^name:\s*(.+)$/m);
  if (nameMatch) meta.name = nameMatch[1].trim();

  // description
  const descMatch = fmBlock.match(/^description:\s*(.+)$/m);
  if (descMatch) meta.description = descMatch[1].trim();

  // version
  const versionMatch = fmBlock.match(/^version:\s*(.+)$/m);
  if (versionMatch) meta.version = versionMatch[1].trim();

  // triggers — supports both inline `[a, b]` and block list `- a`
  const triggersInline = fmBlock.match(/^triggers:\s*\[(.+)\]$/m);
  const triggersBlock = fmBlock.match(/^triggers:\s*\n((?:\s*-\s*.+\n?)+)/m);
  if (triggersInline) {
    meta.triggers = triggersInline[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
  } else if (triggersBlock) {
    meta.triggers = triggersBlock[1]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  } else {
    meta.triggers = [];
  }

  return { meta, body };
}

async function loadSkillsFromDir(dir: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const filePath = path.join(dir, entry);
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const { meta, body } = parseFrontMatter(raw);
        // Derive name from filename if not in front-matter
        const name = meta.name || entry.replace(/\.md$/, '');
        skills.push({
          name,
          description: meta.description || '',
          triggers: meta.triggers || [],
          version: meta.version,
          content: body,
          filePath,
        });
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // dir doesn't exist — that's fine
  }
  return skills;
}

class SkillManager {
  private cache: Skill[] | null = null;

  /** Skill directories in priority order: project-local overrides global */
  private getDirs(cwd?: string): string[] {
    return [
      path.join(os.homedir(), '.koda', 'skills'),
      path.join(cwd ?? process.cwd(), '.koda', 'skills'),
    ];
  }

  async getAll(cwd?: string): Promise<Skill[]> {
    const dirs = this.getDirs(cwd);
    const results = await Promise.all(dirs.map(loadSkillsFromDir));
    // Merge: later dirs (project-local) override earlier (global) by name
    const map = new Map<string, Skill>();
    for (const batch of results) {
      for (const skill of batch) {
        map.set(skill.name, skill);
      }
    }
    this.cache = Array.from(map.values());
    return this.cache;
  }

  async getByName(name: string, cwd?: string): Promise<Skill | undefined> {
    const all = await this.getAll(cwd);
    return all.find(s => s.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Returns skills whose triggers match any word in the given text.
   */
  async getAutoTriggered(text: string): Promise<Skill[]> {
    const all = await this.getAll();
    const lower = text.toLowerCase();
    return all.filter(skill =>
      skill.triggers.some(trigger => lower.includes(trigger.toLowerCase()))
    );
  }

  /** Invalidate cache so next call re-reads from disk */
  invalidate(): void {
    this.cache = null;
  }
}

export const skillManager = new SkillManager();
