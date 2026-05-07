import fs from 'fs/promises';
import path from 'path';

export interface RulesMeta {
  trigger: 'always_on' | 'manual';
}

export interface Rules {
  trigger: 'always_on' | 'manual';
  content: string; // full markdown body (without front-matter)
  filePath: string;
}

/**
 * Parses YAML-like front-matter from rules.md
 * Supports: trigger (always_on | manual)
 */
function parseFrontMatter(raw: string): { meta: Partial<RulesMeta>; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { meta: {}, body: raw };

  const fmBlock = fmMatch[1];
  const body = fmMatch[2].trim();
  const meta: Partial<RulesMeta> = {};

  // trigger
  const triggerMatch = fmBlock.match(/^trigger:\s*(.+)$/m);
  if (triggerMatch) {
    const value = triggerMatch[1].trim();
    if (value === 'always_on' || value === 'manual') {
      meta.trigger = value;
    }
  }

  return { meta, body };
}

class RulesManager {
  private cache: Rules | null = null;
  private lastCwd: string | null = null;

  /**
   * Load rules.md from .agents/rules/rules.md in the current working directory
   */
  async load(cwd: string): Promise<Rules | null> {
    // Invalidate cache if cwd changed
    if (this.lastCwd !== cwd) {
      this.cache = null;
      this.lastCwd = cwd;
    }

    // Return cached if available
    if (this.cache) return this.cache;

    const rulesPath = path.join(cwd, '.agents', 'rules', 'rules.md');
    
    try {
      const raw = await fs.readFile(rulesPath, 'utf-8');
      const { meta, body } = parseFrontMatter(raw);
      
      this.cache = {
        trigger: meta.trigger || 'manual',
        content: body,
        filePath: rulesPath,
      };
      
      return this.cache;
    } catch {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Check if rules should be auto-injected (trigger: always_on)
   */
  async shouldAutoInject(cwd: string): Promise<boolean> {
    const rules = await this.load(cwd);
    return rules?.trigger === 'always_on';
  }

  /**
   * Get rules content if it should be injected
   */
  async getContent(cwd: string): Promise<string | null> {
    const rules = await this.load(cwd);
    if (!rules || rules.trigger !== 'always_on') return null;
    return rules.content;
  }

  /** Invalidate cache so next call re-reads from disk */
  invalidate(): void {
    this.cache = null;
    this.lastCwd = null;
  }
}

export const rulesManager = new RulesManager();
