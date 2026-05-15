import { watch, FSWatcher } from 'fs';
import { BrowserWindow } from 'electron';
import path from 'path';

class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  watch(directory: string) {
    // Stop existing watcher for this directory
    this.unwatch(directory);

    try {
      console.log('[FileWatcher] Starting watch on:', directory);
      
      const watcher = watch(directory, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        console.log('[FileWatcher] Change detected:', eventType, filename);
        
        // Notify renderer about file system changes
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('file-system:change', {
            type: eventType,
            path: path.join(directory, filename),
            directory
          });
        }
      });

      watcher.on('error', (error) => {
        console.error('[FileWatcher] Error:', error);
      });

      this.watchers.set(directory, watcher);
    } catch (error) {
      console.error('[FileWatcher] Failed to start watching:', error);
    }
  }

  unwatch(directory: string) {
    const watcher = this.watchers.get(directory);
    if (watcher) {
      console.log('[FileWatcher] Stopping watch on:', directory);
      watcher.close();
      this.watchers.delete(directory);
    }
  }

  unwatchAll() {
    console.log('[FileWatcher] Stopping all watchers');
    for (const [directory, watcher] of this.watchers.entries()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

export const fileWatcher = new FileWatcherService();
