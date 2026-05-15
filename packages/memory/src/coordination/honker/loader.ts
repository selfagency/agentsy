import { access } from 'node:fs/promises';

export interface HonkerLoadOptions {
  dbPath: string;
  extensionPath: string;
  blake3ExtensionPath: string;
}

export interface HonkerLoadFeatures {
  pubSub: boolean;
  taskQueue: boolean;
  scheduler: boolean;
  blake3: boolean;
}

export interface HonkerLoadResult {
  mode: 'native' | 'fallback';
  dbPath: string;
  features: HonkerLoadFeatures;
  reason?: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadHonkerExtension(options: HonkerLoadOptions): Promise<HonkerLoadResult> {
  const hasHonker = await fileExists(options.extensionPath);
  const hasBlake3 = await fileExists(options.blake3ExtensionPath);

  if (hasHonker && hasBlake3) {
    return {
      mode: 'native',
      dbPath: options.dbPath,
      features: {
        pubSub: true,
        taskQueue: true,
        scheduler: true,
        blake3: true,
      },
    };
  }

  return {
    mode: 'fallback',
    dbPath: options.dbPath,
    features: {
      pubSub: false,
      taskQueue: false,
      scheduler: false,
      blake3: false,
    },
    reason: 'Required native extensions were not found on disk.',
  };
}
