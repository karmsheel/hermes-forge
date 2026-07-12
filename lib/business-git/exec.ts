import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let gitAvailableCache: boolean | null = null;

export async function isGitAvailable(): Promise<boolean> {
  if (gitAvailableCache !== null) return gitAvailableCache;
  try {
    await execFileAsync('git', ['--version'], { windowsHide: true });
    gitAvailableCache = true;
  } catch {
    gitAvailableCache = false;
  }
  return gitAvailableCache;
}

export interface GitExecOptions {
  /** Working directory for git. Defaults to repoPath. */
  cwd?: string;
  /**
   * When true (default for network ops), fail instead of prompting for credentials.
   * Relies on system credential helper / already-authenticated environment.
   */
  noPrompt?: boolean;
  /** Optional timeout in ms (default: none for local ops; push/clone set their own). */
  timeoutMs?: number;
}

export async function git(
  repoPath: string,
  args: string[],
  options: GitExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (options.noPrompt !== false) {
    // Avoid hanging the Electron/Next server waiting for interactive credentials.
    env.GIT_TERMINAL_PROMPT = '0';
  }

  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: options.cwd ?? repoPath,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    env,
    timeout: options.timeoutMs,
  });
  return {
    stdout: stdout.toString().trim(),
    stderr: stderr.toString().trim(),
  };
}

export async function gitHasCommits(repoPath: string): Promise<boolean> {
  try {
    await git(repoPath, ['rev-parse', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

export async function gitStatusPorcelain(repoPath: string): Promise<string> {
  const { stdout } = await git(repoPath, ['status', '--porcelain']);
  return stdout;
}