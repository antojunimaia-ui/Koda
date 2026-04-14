import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

export interface ProjectSession {
  messages: any[];
  pinnedFiles: string[];
  timestamp: number;
}

export class SessionManager {
  private baseDir: string;

  constructor() {
    // Armazena sessões em %AppData%/koda-electron/sessions
    this.baseDir = path.join(app.getPath('userData'), 'sessions');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getSessionPath(projectPath: string): string {
    // Cria um hash fixo do path absoluto para usar como nome de arquivo
    const hash = crypto.createHash('md5').update(projectPath).digest('hex');
    return path.join(this.baseDir, `${hash}.json`);
  }

  public async getSession(projectPath: string): Promise<ProjectSession | null> {
    const sessionPath = this.getSessionPath(projectPath);
    try {
      if (fs.existsSync(sessionPath)) {
        const data = await fs.promises.readFile(sessionPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Error loading session for ${projectPath}:`, error);
    }
    return null;
  }

  public async saveSession(projectPath: string, session: ProjectSession): Promise<void> {
    const sessionPath = this.getSessionPath(projectPath);
    try {
      await fs.promises.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving session for ${projectPath}:`, error);
    }
  }

  public async clearSession(projectPath: string): Promise<void> {
    const sessionPath = this.getSessionPath(projectPath);
    try {
      if (fs.existsSync(sessionPath)) {
        await fs.promises.unlink(sessionPath);
      }
    } catch (error) {
      console.error(`Error clearing session for ${projectPath}:`, error);
    }
  }
}

export const sessionManager = new SessionManager();
