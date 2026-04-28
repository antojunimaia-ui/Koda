import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

export interface ProjectSession {
  messages: any[];
  pinnedFiles: string[];
  timestamp: number;
  projectPath?: string;
  backendHistory?: any[];
  sessionId?: string;
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

  private getSessionPathById(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}.json`);
  }

  private generateSessionId(projectPath: string): string {
    // Generate unique session ID: projectHash-timestamp-random
    const projectHash = crypto.createHash('md5').update(projectPath).digest('hex').slice(0, 8);
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `${projectHash}-${timestamp}-${random}`;
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
    // Usa o sessionId fornecido — nunca gera um novo se já existe
    const sessionId = session.sessionId || this.generateSessionId(projectPath);
    const sessionPath = this.getSessionPathById(sessionId);
    
    try {
      const sessionData = {
        ...session,
        sessionId,
        projectPath,
        timestamp: Date.now()
      };
      await fs.promises.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving session for ${projectPath}:`, error);
    }
  }

  public async getSessionById(sessionId: string): Promise<ProjectSession | null> {
    const sessionPath = this.getSessionPathById(sessionId);
    try {
      if (fs.existsSync(sessionPath)) {
        const data = await fs.promises.readFile(sessionPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Error loading session ${sessionId}:`, error);
    }
    return null;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPathById(sessionId);
    try {
      if (fs.existsSync(sessionPath)) {
        await fs.promises.unlink(sessionPath);
      }
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
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

  public async listSessions(projectPath: string): Promise<Array<{ id: string; title: string; timestamp: number }>> {
    try {
      const files = await fs.promises.readdir(this.baseDir);
      const sessions: Array<{ id: string; title: string; timestamp: number }> = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const sessionPath = path.join(this.baseDir, file);
          const data = await fs.promises.readFile(sessionPath, 'utf8');
          const session: ProjectSession = JSON.parse(data);
          
          // Only include sessions from the same project
          if (session.projectPath === projectPath) {
            // Extract title from first user message
            const firstUserMsg = session.messages?.find((m: any) => m.type === 'user');
            const title = firstUserMsg?.text?.slice(0, 50) || 'Untitled session';
            
            sessions.push({
              id: file.replace('.json', ''),
              title,
              timestamp: session.timestamp || 0
            });
          }
        } catch (err) {
          // Skip invalid session files
          continue;
        }
      }

      // Sort by timestamp descending (newest first)
      return sessions.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error(`Error listing sessions for ${projectPath}:`, error);
      return [];
    }
  }
}

export const sessionManager = new SessionManager();
