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
      dbPath: options.dbPath,
      features: {
        blake3: true,
        pubSub: true,
        scheduler: true,
        taskQueue: true
      },
      mode: 'native'
    };
  }

  return {
    dbPath: options.dbPath,
    features: {
      blake3: false,
      pubSub: false,
      scheduler: false,
      taskQueue: false
    },
    mode: 'fallback',
    reason: 'Required native extensions were not found on disk.'
  };
}
