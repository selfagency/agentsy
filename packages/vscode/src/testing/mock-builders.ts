import type { StreamChunk } from '@agentsy/processor';
import type { RendererHandle } from '@agentsy/core/renderers';
import type { ApiKeyChangeListener } from '../types/index.js';

export interface MockApiKeyManager {
  initialize(): Promise<void>;
  getApiKey(): Promise<string | undefined>;
  setApiKey(key?: string): Promise<void>;
  deleteApiKey(): Promise<void>;
  onDidChangeApiKey(listener: ApiKeyChangeListener): { dispose(): void };
  hasApiKey(): Promise<boolean>;
}

/**
 * Create a lightweight in-memory API key manager stub for integration tests.
 */
export function createMockApiKeyManager(initialKey?: string): MockApiKeyManager {
  let key = initialKey;
  const listeners = new Set<ApiKeyChangeListener>();

  function emit(event: 'updated' | 'deleted', nextKey: string | undefined): void {
    for (const listener of listeners) {
      listener(event, nextKey);
    }
  }

  return {
    async initialize(): Promise<void> {
      // no-op
    },
    async getApiKey(): Promise<string | undefined> {
      return key;
    },
    async setApiKey(nextKey?: string): Promise<void> {
      key = nextKey;
      emit('updated', key);
    },
    async deleteApiKey(): Promise<void> {
      key = undefined;
      emit('deleted', undefined);
    },
    onDidChangeApiKey(listener: ApiKeyChangeListener): { dispose(): void } {
      listeners.add(listener);
      return {
        dispose(): void {
          listeners.delete(listener);
        },
      };
    },
    async hasApiKey(): Promise<boolean> {
      return key !== undefined && key.length > 0;
    },
  };
}

export interface MockRendererHandle extends RendererHandle {
  writes: string[];
  chunks: StreamChunk[];
  ended: boolean;
}

/**
 * Create a renderer handle test double that records writes/chunks.
 */
export function createMockRendererHandle(): MockRendererHandle {
  const writes: string[] = [];
  const chunks: StreamChunk[] = [];
  let ended = false;

  return {
    writes,
    chunks,
    get ended() {
      return ended;
    },
    async write(chunk: string): Promise<void> {
      writes.push(chunk);
    },
    async writeChunk(chunk: StreamChunk): Promise<void> {
      chunks.push(chunk);
    },
    async end(): Promise<void> {
      ended = true;
    },
  };
}

/**
 * Build a normalizer stub that maps arbitrary source events into stream chunks.
 */
export function createChunkNormalizerStub<TEvent>(
  mapper: (event: TEvent) => StreamChunk | null,
): (source: AsyncIterable<TEvent>) => AsyncIterable<StreamChunk> {
  return async function* normalize(source: AsyncIterable<TEvent>): AsyncIterable<StreamChunk> {
    for await (const event of source) {
      const chunk = mapper(event);
      if (chunk !== null) {
        yield chunk;
      }
    }
  };
}
