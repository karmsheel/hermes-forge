export type DesktopUpdatePhase =
  | "idle"
  | "checking"
  | "not-available"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export interface DesktopUpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface DesktopUpdateStatus {
  phase: DesktopUpdatePhase;
  currentVersion: string;
  version: string | null;
  releaseNotes: string | null;
  progress: DesktopUpdateProgress | null;
  error: string | null;
}

export function isDesktopUpdateVisible(status: DesktopUpdateStatus): boolean {
  return (
    status.phase === "available" ||
    status.phase === "downloading" ||
    status.phase === "downloaded" ||
    (status.phase === "error" && Boolean(status.version))
  );
}