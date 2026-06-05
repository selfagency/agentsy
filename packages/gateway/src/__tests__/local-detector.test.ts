/**
 * Comprehensive tests for LocalModelDetector with mocked fetch.
 * Covers all public methods, private method paths, and edge cases.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalModelDetector } from '../local-detector.js';

// =============================================================================
// Helpers
// =============================================================================

let fetchCallCount = 0;

/**
 * Provide one response per backend call. The detector probes 3 backends
 * in parallel (Ollama, Apfel, Jan). Each call gets the next response in
 * the array. When the array is shorter than the number of calls, the
 * last response is reused.
 */
function mockResponses(responses: Response[]): void {
  const impl = vi.fn().mockImplementation(() => {
    const idx = Math.min(fetchCallCount, responses.length - 1);
    fetchCallCount++;
    const response: Response | undefined = responses[idx];
    return Promise.resolve(response);
  });
  vi.stubGlobal('fetch', impl);
}

/**
 * All 3 backends get the same JSON body. Builds 3 independent Response
 * objects so .json() can be called on each without consuming the body.
 */
function mockAllBackends(body: unknown, status = 200): void {
  const json = JSON.stringify(body);
  mockResponses([
    new Response(json, { status, headers: { 'Content-Type': 'application/json' } }),
    new Response(json, { status, headers: { 'Content-Type': 'application/json' } }),
    new Response(json, { status, headers: { 'Content-Type': 'application/json' } })
  ]);
}

/** All 3 backends fail with the given error. */
function mockAllFail(): void {
  mockResponses([
    new Response(null, { status: 503 }),
    new Response(null, { status: 503 }),
    new Response(null, { status: 503 })
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchCallCount = 0;
});

// =============================================================================
// detectAvailableLocalModels
// =============================================================================

describe('detectAvailableLocalModels', () => {
  it('returns empty array when all backends fail', async () => {
    mockAllFail();
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });

  it('returns entries from reachable backends with model list', async () => {
    mockAllBackends({ models: [{ name: 'llama3.2:1b' }, { name: 'llama3.3:70b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models.length).toBeGreaterThanOrEqual(2);
    expect(models[0]?.isLocal).toBe(true);
    expect(models[0]?.cost.inputPer1MTokens).toBe(0);
  });

  it('handles backends that return model names as strings', async () => {
    mockAllBackends({ data: ['model-a', 'model-b'] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    // Jan backend uses path 'data' — only Jan's response returns these
    expect(models.length).toBeGreaterThanOrEqual(2);
  });

  it('handles backends with empty model list', async () => {
    mockAllBackends({ models: [] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });

  it('handles backends with missing model key', async () => {
    mockAllBackends({ notModels: [] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });
});

// =============================================================================
// detectLocalReplicas
// =============================================================================

describe('detectLocalReplicas', () => {
  it('returns replicas from reachable backends', async () => {
    mockAllBackends({ models: [{ name: 'llama3.2:1b' }] });
    const detector = new LocalModelDetector();
    const replicas = await detector.detectLocalReplicas();
    expect(replicas.length).toBeGreaterThanOrEqual(1);
    expect(replicas[0]?.isLocal).toBe(true);
    expect(replicas[0]?.cost.inputPer1MTokens).toBe(0);
    expect(replicas[0]?.logicalModelId).toBe('llama3.2:1b');
  });

  it('returns empty array when all backends fail', async () => {
    mockAllFail();
    const detector = new LocalModelDetector();
    const replicas = await detector.detectLocalReplicas();
    expect(replicas).toEqual([]);
  });
});

// =============================================================================
// #inferTier
// =============================================================================

describe('tier inference', () => {
  it('infers micro for 1b models', async () => {
    mockAllBackends({ models: [{ name: 'llama3.2:1b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('micro');
  });

  it('infers micro for 3b models', async () => {
    mockAllBackends({ models: [{ name: 'phi-3:3b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('micro');
  });

  it('infers micro for tiny models', async () => {
    mockAllBackends({ models: [{ name: 'tinyllama' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('micro');
  });

  it('infers small for 7b models', async () => {
    mockAllBackends({ models: [{ name: 'mistral-7b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('small');
  });

  it('infers small for 8b models', async () => {
    mockAllBackends({ models: [{ name: 'llama3.1:8b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('small');
  });

  it('infers small for models with "small" in name', async () => {
    mockAllBackends({ models: [{ name: 'smally-model' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('small');
  });

  it('infers mid for 70b models', async () => {
    mockAllBackends({ models: [{ name: 'llama3.3:70b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('mid');
  });

  it('infers mid for 405b models', async () => {
    mockAllBackends({ models: [{ name: 'llama3.1:405b' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('mid');
  });

  it('defaults to small for unknown model sizes', async () => {
    mockAllBackends({ models: [{ name: 'custom-model' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models[0]?.tier).toBe('small');
  });
});

// =============================================================================
// extractModelNames edge cases
// =============================================================================

describe('extractModelNames edge cases', () => {
  it('handles null body gracefully', async () => {
    mockAllBackends(null);
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });

  it('handles non-object body gracefully', async () => {
    mockAllBackends('just a string');
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });

  it('handles nested path traversal with data array', async () => {
    mockAllBackends({ data: [{ id: 'model-x' }] });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models[0]?.modelName).toBe('model-x');
  });

  it('handles intermediate null in path', async () => {
    mockAllBackends({ data: null });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });

  it('handles non-array final value in path', async () => {
    mockAllBackends({ models: 'not-an-array' });
    const detector = new LocalModelDetector();
    const models = await detector.detectAvailableLocalModels();
    expect(models).toEqual([]);
  });
});
