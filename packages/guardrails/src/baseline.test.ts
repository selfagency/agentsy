import { describe, expect, it } from 'vitest';

import { BaselineManager, fingerprint } from './baseline.js';
import type { Detection } from './types.js';

// =============================================================================
// fingerprint
// =============================================================================

describe('fingerprint', () => {
  it('creates deterministic sha256 hex hash', () => {
    const fp1 = fingerprint('aws-access-key', 'AKIAIOSFODNN7EXAMPLE');
    const fp2 = fingerprint('aws-access-key', 'AKIAIOSFODNN7EXAMPLE');
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64); // sha256 hex = 64 chars
  });

  it('produces different hashes for different inputs', () => {
    const fp1 = fingerprint('aws-access-key', 'AKIAIOSFODNN7EXAMPLE');
    const fp2 = fingerprint('github-token', 'ghp_abc123');
    expect(fp1).not.toBe(fp2);
  });

  it('never stores the original value in the fingerprint', () => {
    const fp = fingerprint('secret', 'my-super-secret-value-12345');
    expect(fp).not.toContain('my-super-secret-value');
    expect(fp).not.toContain('secret');
  });
});

// =============================================================================
// BaselineManager
// =============================================================================

describe('BaselineManager', () => {
  it('starts empty when no baseline is provided', () => {
    const mgr = new BaselineManager();
    expect(mgr.size).toBe(0);
  });

  it('isSuppressed returns false for unknown detection', () => {
    const mgr = new BaselineManager();
    const detection: Detection = { id: 'test-key', description: 'test', severity: 'high' };
    expect(mgr.isSuppressed(detection, 'some-value')).toBe(false);
  });

  it('isSuppressed returns true after adding', () => {
    const mgr = new BaselineManager();
    const detection: Detection = { id: 'test-key', description: 'test', severity: 'high' };
    mgr.add(detection, 'some-value', 'Known test key');
    expect(mgr.isSuppressed(detection, 'some-value')).toBe(true);
  });

  it('does not add duplicate fingerprints', () => {
    const mgr = new BaselineManager();
    const detection: Detection = { id: 'test-key', description: 'test', severity: 'high' };
    mgr.add(detection, 'some-value');
    mgr.add(detection, 'some-value');
    expect(mgr.size).toBe(1);
  });

  it('remove deletes a baseline entry', () => {
    const mgr = new BaselineManager();
    const detection: Detection = { id: 'test-key', description: 'test', severity: 'high' };
    mgr.add(detection, 'some-value');
    expect(mgr.size).toBe(1);

    // Get the fingerprint
    const fp = fingerprint('test-key', 'some-value');
    const removed = mgr.remove(fp);
    expect(removed).toBe(true);
    expect(mgr.size).toBe(0);
  });

  it('remove returns false for non-existent fingerprint', () => {
    const mgr = new BaselineManager();
    const result = mgr.remove('nonexistent');
    expect(result).toBe(false);
  });

  it('filter excludes baseline entries', () => {
    const mgr = new BaselineManager();
    const detection1: Detection = { id: 'key-1', description: 'test 1', severity: 'high' };
    const detection2: Detection = { id: 'key-2', description: 'test 2', severity: 'high' };

    mgr.add(detection1, 'value-1');

    const filtered = mgr.filter([
      { detection: detection1, value: 'value-1' },
      { detection: detection2, value: 'value-2' }
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.detection.id).toBe('key-2');
  });

  it('snapshot returns a copy of the baseline', () => {
    const mgr = new BaselineManager();
    const detection: Detection = { id: 'test-key', description: 'test', severity: 'high' };
    mgr.add(detection, 'some-value');

    const snap = mgr.snapshot();
    expect(snap.version).toBe(1);
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0]?.detectionId).toBe('test-key');

    // Modifying snap should not affect mgr
    snap.entries = [];
    expect(mgr.size).toBe(1);
  });

  it('isSuppressed works with multiple baseline entries', () => {
    const mgr = new BaselineManager();
    const d1: Detection = { id: 'key-1', description: 'first', severity: 'high' };
    const d2: Detection = { id: 'key-2', description: 'second', severity: 'medium' };

    mgr.add(d1, 'value1');
    mgr.add(d2, 'value2');

    expect(mgr.isSuppressed(d1, 'value1')).toBe(true);
    expect(mgr.isSuppressed(d2, 'value2')).toBe(true);
    expect(mgr.isSuppressed(d1, 'other')).toBe(false);
  });
});
