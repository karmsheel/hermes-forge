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

export async function git(
  repoPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: repoPath,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
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