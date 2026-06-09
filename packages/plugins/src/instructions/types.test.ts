import { describe, expect, it } from 'vitest';
import type { InstructionFile } from './types.js';

describe('InstructionFile type', () => {
  it('allows a minimal valid object', () => {
    const file: InstructionFile = {
      path: '/project/AGENTS.md',
      alwaysInject: true,
      content: '# Instructions',
      priority: 90
    };

    expect(file.path).toBe('/project/AGENTS.md');
    expect(file.alwaysInject).toBe(true);
    expect(file.content).toBe('# Instructions');
    expect(file.priority).toBe(90);
  });

  it('allows all optional fields', () => {
    const file: InstructionFile = {
      path: '/project/.cursor/rules/typescript.md',
      scope: 'workspace',
      alwaysInject: false,
      content: '- Always use strict mode',
      priority: 60,
      applyTo: '**/*.ts'
    };

    expect(file.scope).toBe('workspace');
    expect(file.applyTo).toBe('**/*.ts');
  });

  it('marks scope as undefined when omitted', () => {
    const file: InstructionFile = {
      path: '/project/CLAUDE.md',
      alwaysInject: true,
      content: 'guide',
      priority: 80
    };

    expect(file.scope).toBeUndefined();
  });

  it('accepts edge priority values', () => {
    const low: InstructionFile = {
      path: '/low.md',
      alwaysInject: false,
      content: '',
      priority: 0
    };
    const high: InstructionFile = {
      path: '/high.md',
      alwaysInject: false,
      content: '',
      priority: 100
    };

    expect(low.priority).toBe(0);
    expect(high.priority).toBe(100);
  });

  it('treats all fields as readonly', () => {
    const file: InstructionFile = {
      path: '/test.md',
      alwaysInject: true,
      content: 'content',
      priority: 50
    };

    // @ts-expect-error - path is readonly
    file.path = '/other.md';
    // @ts-expect-error - content is readonly
    file.content = 'updated';
    // @ts-expect-error - priority is readonly
    file.priority = 0;
  });
});
