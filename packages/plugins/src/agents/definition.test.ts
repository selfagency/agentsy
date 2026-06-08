import { describe, expect, it } from 'vitest';

import type { AgentDefinition, AgentDefinitionSource, AgentMemoryScope, AgentOrchestrationMode } from './definition.js';

describe('AgentDefinition type', () => {
  it('creates a minimal definition with required fields', () => {
    const def: AgentDefinition = {
      id: 'test-agent',
      name: 'Test Agent',
      description: 'A minimal agent',
      source: 'bundled'
    };

    expect(def.id).toBe('test-agent');
    expect(def.name).toBe('Test Agent');
    expect(def.description).toBe('A minimal agent');
    expect(def.source).toBe('bundled');
  });

  it('creates a definition with all optional fields', () => {
    const def: AgentDefinition = {
      id: 'full-agent',
      name: 'Full Agent',
      description: 'An agent with everything',
      systemPromptTemplate: 'You are {{role}}.',
      allowedTools: ['web-search', 'file-read'],
      memoryScopes: ['session', 'workspace'],
      orchestrationMode: 'orchestrated',
      defaultModel: 'claude-sonnet-4-20250514',
      hooks: {
        'pre-turn': 'memory:pre-turn',
        'post-turn': 'memory:post-turn'
      },
      source: 'user'
    };

    expect(def.systemPromptTemplate).toBe('You are {{role}}.');
    expect(def.allowedTools).toStrictEqual(['web-search', 'file-read']);
    expect(def.memoryScopes).toStrictEqual(['session', 'workspace']);
    expect(def.orchestrationMode).toBe('orchestrated');
    expect(def.defaultModel).toBe('claude-sonnet-4-20250514');
    expect(def.hooks?.['pre-turn']).toBe('memory:pre-turn');
    expect(def.source).toBe('user');
  });

  it('accepts wildcard tools', () => {
    const def: AgentDefinition = {
      id: 'default',
      name: 'Default',
      description: 'Unrestricted agent',
      allowedTools: '*',
      source: 'bundled'
    };

    expect(def.allowedTools).toBe('*');
  });

  it('accepts all source types', () => {
    const sources: AgentDefinitionSource[] = ['bundled', 'user', 'workspace'];

    for (const source of sources) {
      const def: AgentDefinition = {
        id: 'a',
        name: 'A',
        description: 'desc',
        source
      };
      expect(def.source).toBe(source);
    }
  });

  it('accepts all orchestration modes', () => {
    const modes: AgentOrchestrationMode[] = ['single', 'orchestrated', 'autonomous'];

    for (const mode of modes) {
      const def: AgentDefinition = {
        id: 'a',
        name: 'A',
        description: 'desc',
        orchestrationMode: mode,
        source: 'bundled'
      };
      expect(def.orchestrationMode).toBe(mode);
    }
  });

  it('accepts all memory scopes', () => {
    const scopes: AgentMemoryScope[] = ['session', 'workspace', 'user'];

    for (const scope of scopes) {
      const def: AgentDefinition = {
        id: 'a',
        name: 'A',
        description: 'desc',
        memoryScopes: [scope],
        source: 'bundled'
      };
      expect(def.memoryScopes).toStrictEqual([scope]);
    }
  });
});
