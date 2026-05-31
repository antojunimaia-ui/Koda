import { readFile, writeFile, mkdir, stat } from "fs/promises";
import { resolve, dirname } from "path";
import { globby } from "globby";

/**
 * A full snapshot of workspace files at a point in time.
 * Key = absolute file path, Value = file contents.
 */
export interface WorkspaceSnapshot {
  messageId: number;
  timestamp: number;
  files: Record<string, string>;
  /** The number of messages in the Conversation at snapshot time */
  conversationLength: number;
}

const IGNORED = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/dist-electron/**",
  "**/release-build/**",
  "**/release/**",
  "**/package-lock.json",
  "**/yarn.lock",
];

// In-memory store keyed by UI message ID
const snapshots = new Map<number, WorkspaceSnapshot>();

/**
 * Captures all non-ignored text files in `cwd` and stores them
 * under `messageId`. Call this BEFORE the agent starts processing
 * the user's message.
 */
// Cache to avoid reading the same unchanged file repeatedly
const fileCache = new Map<string, { mtimeMs: number; size: number; content: string }>();

export async function createSnapshot(
  cwd: string,
  messageId: number,
  conversationLength: number
): Promise<void> {
  // Yield to the event loop immediately so the caller isn't blocked
  await new Promise(r => setTimeout(r, 0));

  const files = await globby(["**/*"], {
    ignore: IGNORED,
    dot: true,
    onlyFiles: true,
    cwd,
  });

  const fileMap: Record<string, string> = {};

  // Process files in chunks to avoid blocking the event loop
  const CHUNK_SIZE = 50;
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (relPath) => {
        const absPath = resolve(cwd, relPath);
        try {
          const fileStat = await stat(absPath);
          // Skip binary files larger than 2 MB or binary blobs
          if (fileStat.size > 2 * 1024 * 1024) return;
          
          const cached = fileCache.get(absPath);
          if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
            fileMap[absPath] = cached.content;
            return;
          }

          const content = await readFile(absPath, "utf-8");
          fileCache.set(absPath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, content });
          fileMap[absPath] = content;
        } catch {
          // Unreadable / binary — skip silently
        }
      })
    );
    // Yield to the event loop
    await new Promise((r) => setTimeout(r, 0));
  }

  snapshots.set(messageId, {
    messageId,
    timestamp: Date.now(),
    files: fileMap,
    conversationLength,
  });
}

/**
 * Restores all files from the snapshot associated with `messageId`.
 * Returns the previous conversation length so the Agent can truncate,
 * or null if no snapshot exists for this ID.
 */
export async function restoreSnapshot(
  messageId: number
): Promise<{ conversationLength: number } | null> {
  const snap = snapshots.get(messageId);
  if (!snap) return null;

  await Promise.all(
    Object.entries(snap.files).map(async ([absPath, content]) => {
      try {
        await mkdir(dirname(absPath), { recursive: true });
        await writeFile(absPath, content, "utf-8");
      } catch {
        // Best effort
      }
    })
  );

  // Remove all snapshots taken after this point
  for (const [id] of snapshots) {
    if (id >= messageId) {
      snapshots.delete(id);
    }
  }

  return { conversationLength: snap.conversationLength };
}

/** Returns all stored snapshot IDs, sorted ascending */
export function listSnapshotIds(): number[] {
  return Array.from(snapshots.keys()).sort((a, b) => a - b);
}
