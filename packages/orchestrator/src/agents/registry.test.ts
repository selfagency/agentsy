import { describe, expect, it } from 'vitest';

import type { AgentCapabilities } from '../types/index.js';
import { AgentRegistry } from './registry.js';

function createAgent(overrides: Partial<AgentCapabilities> = {}): AgentCapabilities {
  return {
    id: overrides.id ?? 'agent-1',
    name: overrides.name ?? 'Agent 1',
    skills: overrides.skills ?? [
      {
        id: 'skill-1',
        name: 'summarization',
        category: 'nlp',
        proficiency: 'advanced',
        capabilities: ['summarize']
      }
    ],
    maxConcurrency: overrides.maxConcurrency ?? 1,
    costPerTask: overrides.costPerTask ?? 0.1,
    available: overrides.available ?? true,
    lastSeen: overrides.lastSeen ?? new Date('2026-01-01T00:00:00.000Z')
  };
}

describe('AgentRegistry', () => {
  it('registers and unregisters agents and updates skill lookup', () => {
    const registry = new AgentRegistry();
    const agent = createAgent({ id: 'agent-a' });

    registry.register(agent);

    expect(registry.getAgent('agent-a')).toEqual(agent);
    expect(registry.findAgentsBySkill('summarization').map(item => item.id)).toEqual(['agent-a']);

    registry.unregister('agent-a');

    expect(registry.getAgent('agent-a')).toBeUndefined();
    expect(registry.findAgentsBySkill('summarization')).toEqual([]);
  });

  it('finds agents by multiple skills with proficiency checks', () => {
    const registry = new AgentRegistry();

    registry.register(
      createAgent({
        id: 'agent-expert',
        skills: [
          {
            id: 'skill-ts',
            name: 'typescript',
            category: 'language',
            proficiency: 'expert',
            capabilities: ['coding']
          },
          {
            id: 'skill-test',
            name: 'testing',
            category: 'quality',
            proficiency: 'advanced',
            capabilities: ['unit-tests']
          }
        ]
      })
    );

    registry.register(
      createAgent({
        id: 'agent-beginner',
        skills: [
          {
            id: 'skill-ts-low',
            name: 'typescript',
            category: 'language',
            proficiency: 'beginner',
            capabilities: ['coding']
          },
          {
            id: 'skill-test-low',
            name: 'testing',
            category: 'quality',
            proficiency: 'intermediate',
            capabilities: ['unit-tests']
          }
        ]
      })
    );

    const matched = registry.findAgentsBySkills([
      { name: 'typescript', proficiency: 'advanced' },
      { name: 'testing', proficiency: 'advanced' }
    ]);

    expect(matched.map(item => item.id)).toEqual(['agent-expert']);
  });

  it('updates agent availability and lastSeen', () => {
    const registry = new AgentRegistry();
    const originalLastSeen = new Date('2026-01-01T00:00:00.000Z');

    registry.register(
      createAgent({
        id: 'agent-update',
        available: true,
        lastSeen: originalLastSeen
      })
    );

    registry.updateAvailability('agent-update', false);

    const updated = registry.getAgent('agent-update');
    expect(updated?.available).toBe(false);
    expect(updated?.lastSeen.getTime()).toBeGreaterThanOrEqual(originalLastSeen.getTime());
  });
});
