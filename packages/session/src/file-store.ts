import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SessionStore } from './store.js';

const DEFAULT_SESSION_DIR = resolve(process.env.HOME ?? '/tmp', '.agentsy');
const DEFAULT_FILE_PATH = resolve(DEFAULT_SESSION_DIR, 'sessions.json');

export function getDefaultSessionFilePath(): string {
  return DEFAULT_FILE_PATH;
}

export function createFileStore(filePath?: string): SessionStore {
  const resolvedPath = resolve(filePath ?? DEFAULT_FILE_PATH);
  const data: Record<string, unknown> = Object.create(null);

  function load(): void {
    if (!existsSync(resolvedPath)) {
      return;
    }
    try {
      const raw = readFileSync(resolvedPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const source = parsed as Record<string, unknown>;
        for (const key of Object.keys(source)) {
          if (Object.hasOwn(source, key)) {
            data[key] = source[key];
          }
        }
      }
    } catch {
      // Corrupted file — start fresh
    }
  }

  function flush(): void {
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(resolvedPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  load();

  return {
    clear(): void {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
      flush();
    },
    getState() {
      return {
        id: '',
        values: { ...data }
      };
    },
    getValue<T = unknown>(key: string): T | undefined {
      if (!Object.hasOwn(data, key)) {
        return;
      }
      return data[key] as T | undefined;
    },
    listKeys(): string[] {
      return Object.keys(data);
    },
    removeValue(key: string): void {
      if (Object.hasOwn(data, key)) {
        delete data[key];
      }
      flush();
    },
    setValue(key: string, value: unknown): void {
      data[key] = value;
      flush();
    }
  };
}
