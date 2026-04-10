/**
 * Lightweight in-session file access tracker.
 * Collects which files the agent read or modified during the current session.
 * Emits an IPC event to the renderer whenever the list changes.
 */

import { BrowserWindow } from "electron";

export type FileAccessType = "read" | "modified";

interface TrackedFile {
  path: string;
  access: FileAccessType;
  /** Most recent access timestamp */
  timestamp: number;
}

const trackedFiles = new Map<string, TrackedFile>();

function emit() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  win.webContents.send("agent:update", {
    type: "files_tracked",
    files: getTrackedFiles(),
  });
}

export function trackFile(absPath: string, access: FileAccessType): void {
  const existing = trackedFiles.get(absPath);
  // Upgrade "read" to "modified" but never downgrade
  const finalAccess =
    existing?.access === "modified" && access === "read" ? "modified" : access;

  trackedFiles.set(absPath, {
    path: absPath,
    access: finalAccess,
    timestamp: Date.now(),
  });

  emit();
}

export function getTrackedFiles(): TrackedFile[] {
  return Array.from(trackedFiles.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );
}

export function clearTrackedFiles(): void {
  trackedFiles.clear();
  emit();
}
