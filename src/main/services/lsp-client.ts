import { spawn, ChildProcess } from 'child_process';
import * as rpc from 'vscode-jsonrpc/node.js';
import * as lsp from 'vscode-languageserver-protocol';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';

export class LSPClient {
  private childProcess: ChildProcess | null = null;
  private connection: rpc.MessageConnection | null = null;
  private rootPath: string;
  private openedFiles = new Set<string>();

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  private uri(filePath: string): string {
    return pathToFileURL(resolve(this.rootPath, filePath)).href;
  }

  async start(): Promise<void> {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    this.childProcess = spawn(
      cmd,
      ['typescript-language-server', '--stdio'],
      { cwd: this.rootPath }
    );

    this.childProcess.stderr?.on('data', (data) => {
      console.log(`[LSP] stderr: ${data}`);
    });

    this.connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(this.childProcess.stdout!),
      new rpc.StreamMessageWriter(this.childProcess.stdin!)
    );

    this.connection.listen();

    const initParams: lsp.InitializeParams = {
      processId: process.pid,
      rootUri: `file:///${this.rootPath.replace(/\\/g, '/')}`,
      capabilities: {
        workspace: {
          workspaceFolders: true
        },
        textDocument: {
          hover: { dynamicRegistration: true },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          documentSymbol: { dynamicRegistration: true }
        }
      } as any,
      workspaceFolders: [
        {
          uri: `file:///${this.rootPath.replace(/\\/g, '/')}`,
          name: 'project'
        }
      ]
    };

    await this.connection.sendRequest(lsp.InitializeRequest.type.method, initParams);
    this.connection.sendNotification(lsp.InitializedNotification.type.method, {});
  }

  async stop(): Promise<void> {
    if (this.connection) {
      await this.connection.sendRequest(lsp.ShutdownRequest.type.method);
      this.connection.sendNotification(lsp.ExitNotification.type.method);
      this.connection.dispose();
      this.connection = null;
    }
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  async openFile(filePath: string) {
    const fileUri = this.uri(filePath);
    if (!this.connection || this.openedFiles.has(fileUri)) return fileUri;
    
    try {
      const content = await readFile(resolve(this.rootPath, filePath), 'utf-8');
      this.connection.sendNotification(lsp.DidOpenTextDocumentNotification.type.method, {
        textDocument: {
          uri: fileUri,
          languageId: filePath.endsWith('ts') || filePath.endsWith('tsx') ? 'typescript' : 'javascript',
          version: 1,
          text: content
        }
      });
      this.openedFiles.add(fileUri);
      return fileUri;
    } catch (err) {
      throw new Error(`Failed to open file ${filePath} for LSP: ` + String(err));
    }
  }

  async getDefinition(filePath: string, line: number, character: number) {
    if (!this.connection) throw new Error('LSP not started');
    const fileUri = await this.openFile(filePath);
    return this.connection.sendRequest(lsp.DefinitionRequest.type.method, {
      textDocument: { uri: fileUri },
      position: { line: line - 1, character: character - 1 }
    });
  }

  async getHover(filePath: string, line: number, character: number) {
    if (!this.connection) throw new Error('LSP not started');
    const fileUri = await this.openFile(filePath);
    return this.connection.sendRequest(lsp.HoverRequest.type.method, {
      textDocument: { uri: fileUri },
      position: { line: line - 1, character: character - 1 }
    });
  }
}
