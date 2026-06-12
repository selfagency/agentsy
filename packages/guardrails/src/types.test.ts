import { describe, expect, it } from 'vitest';
import type { Detection, GuardrailResult, GuardrailScanner } from './types.js';

describe('GuardrailResult discriminated union', () => {
  it('pass variant has no extra fields', () => {
    const result: GuardrailResult = { status: 'pass', phase: 'input' };
    expect(result.status).toBe('pass');
    expect(result.phase).toBe('input');
  });

  it('block variant requires reason', () => {
    const result: GuardrailResult = {
      status: 'block',
      phase: 'tool-input',
      reason: 'Command injection detected'
    };
    expect(result.status).toBe('block');
    expect(result.reason).toContain('injection');
  });

  it('block variant can include detections', () => {
    const detection: Detection = {
      id: 'det-001',
      category: 'asi-04',
      description: 'Semicolon detected in path argument',
      severity: 'high',
      location: '/bin/sh -c "cat /etc/passwd"',
      snippet: '; cat'
    };
    const result: GuardrailResult = {
      status: 'block',
      phase: 'tool-input',
      reason: 'Command injection detected',
      detections: [detection]
    };
    expect(result.detections).toHaveLength(1);
    expect(result.detections?.[0]?.id).toBe('det-001');
  });

  it('transform variant carries sanitized string', () => {
    const result: GuardrailResult = {
      status: 'transform',
      phase: 'output',
      sanitized: 'Hello, [REDACTED]!'
    };
    expect(result.sanitized).toBe('Hello, [REDACTED]!');
  });

  it('escalate variant has riskScore', () => {
    const result: GuardrailResult = {
      status: 'escalate',
      phase: 'approval',
      reason: 'File write to /etc/passwd',
      riskScore: 0.92
    };
    expect(result.riskScore).toBeGreaterThan(0.9);
  });
});

describe('GuardrailScanner interface contract', () => {
  it('passing scanner returns pass', async () => {
    const scanner: GuardrailScanner = {
      metadata: {
        id: 'test/pass',
        name: 'Test Pass',
        version: '1.0.0',
        description: 'Always passes',
        priority: 10,
        owaspCategories: [],
        tags: ['test']
      },
      evaluate: async () => ({ status: 'pass', phase: 'input' })
    };
    const result = await scanner.evaluate('anything', {});
    expect(result.status).toBe('pass');
  });

  it('sync scanner works (no async needed)', () => {
    const scanner: GuardrailScanner = {
      metadata: {
        id: 'test/sync',
        name: 'Sync Scanner',
        version: '1.0.0',
        description: 'Synchronous',
        priority: 10,
        owaspCategories: [],
        tags: ['test']
      },
      evaluate: () => ({ status: 'pass', phase: 'input' })
    };
    const result = scanner.evaluate('x');
    expect('status' in result).toBe(true);
  });
});
