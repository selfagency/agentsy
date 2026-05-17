import { spawnSync } from 'node:child_process';
import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process';

const SAFE_PATH = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':');

export interface GitHelpers {
  resolveGitExecutable(): string | null;
  runGit(args: readonly string[], options?: SpawnSyncOptions): SpawnSyncReturns<string>;
  setGitCommand(command: string): void;
}

export function createGitHelpers(root: string): GitHelpers {
  let gitCommand = 'git';

  function withSafePathEnv(): NodeJS.ProcessEnv {
    return { ...process.env, PATH: SAFE_PATH };
  }

  function runGit(args: readonly string[], options: SpawnSyncOptions = {}): SpawnSyncReturns<string> {
    const result = spawnSync(gitCommand, args, {
      cwd: root,
      encoding: 'utf-8',
      shell: false,
      ...options
    });

    if (result.status !== 0) {
      const stderr = String(result.stderr || '').trim();
      const stdout = String(result.stdout || '').trim();
      const details = stderr ?? stdout ?? `git ${args.join(' ')} failed with exit code ${result.status}`;
      throw new Error(details);
    }

    // Ensure the result is properly typed as string
    return result as unknown as SpawnSyncReturns<string>;
  }

  function resolveGitExecutable(): string | null {
    const direct = spawnSync('git', ['--version'], {
      env: withSafePathEnv(),
      shell: false,
      stdio: 'ignore'
    });

    if (direct.status === 0) {
      return 'git';
    }

    const locatorCommand = process.platform === 'win32' ? 'where' : 'which';
    const located = spawnSync(locatorCommand, ['git'], {
      encoding: 'utf-8',
      env: withSafePathEnv(),
      shell: false
    });

    if (located.status === 0) {
      const candidate = located.stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(Boolean);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  return {
    resolveGitExecutable,
    runGit,
    setGitCommand(command: string): void {
      gitCommand = command;
    }
  };
}
