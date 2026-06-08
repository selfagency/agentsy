/* oxlint-disable import/no-extraneous-dependencies -- test file */
import { describe, expect, it } from 'vitest';
import { type ActiveSkill, type SkillEntry, SkillsComposer, type SkillsLayer } from './skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<ActiveSkill> & { name: string; description: string }): ActiveSkill {
  return {
    name: overrides.name,
    description: overrides.description,
    tokenCount: overrides.tokenCount ?? 10
  };
}

// ---------------------------------------------------------------------------
// SkillsLayer type
// ---------------------------------------------------------------------------

describe('SkillsLayer type', () => {
  it('creates a layer with required fields', () => {
    const skills: SkillEntry[] = [{ name: 'code-review', description: 'Reviews code changes' }];
    const layer: SkillsLayer = {
      type: 'skills',
      skills,
      tokenCount: 10
    };
    expect(layer.type).toBe('skills');
    expect(layer.skills).toHaveLength(1);
    expect(layer.skills[0]?.name).toBe('code-review');
    expect(layer.tokenCount).toBe(10);
  });

  it('discriminates via type field', () => {
    const layer: SkillsLayer = {
      type: 'skills',
      skills: [],
      tokenCount: 0
    };
    // Type-narrowing check — compiled TS ensures only 'skills' is accepted
    expect(layer.type).toBe('skills');
  });
});

// ---------------------------------------------------------------------------
// SkillsComposer
// ---------------------------------------------------------------------------

describe('SkillsComposer', () => {
  const composer = new SkillsComposer();

  describe('compose', () => {
    it('returns empty layer when given no skills', () => {
      const result = composer.compose([]);
      expect(result.type).toBe('skills');
      expect(result.skills).toHaveLength(0);
      expect(result.tokenCount).toBe(0);
    });

    it('maps ActiveSkill to { name, description }', () => {
      const skill = makeSkill({
        name: 'code-review',
        description: 'Reviews code changes for quality and security'
      });

      const result = composer.compose([skill]);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0]?.name).toBe('code-review');
      expect(result.skills[0]?.description).toBe('Reviews code changes for quality and security');
    });

    it('sums token counts from all skills', () => {
      const a = makeSkill({ name: 'skill-a', description: 'First skill', tokenCount: 10 });
      const b = makeSkill({ name: 'skill-b', description: 'Second skill', tokenCount: 20 });
      const c = makeSkill({ name: 'skill-c', description: 'Third skill', tokenCount: 30 });

      const result = composer.compose([a, b, c]);
      expect(result.tokenCount).toBe(60);
    });

    it('preserves input order of skills', () => {
      const first = makeSkill({ name: 'alpha', description: 'First in order' });
      const second = makeSkill({ name: 'beta', description: 'Second in order' });
      const third = makeSkill({ name: 'gamma', description: 'Third in order' });

      const result = composer.compose([first, second, third]);
      expect(result.skills[0]?.name).toBe('alpha');
      expect(result.skills[1]?.name).toBe('beta');
      expect(result.skills[2]?.name).toBe('gamma');
    });

    it('handles single active skill', () => {
      const skill = makeSkill({
        name: 'lone-skill',
        description: 'Only one skill active',
        tokenCount: 42
      });

      const result = composer.compose([skill]);
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0]?.name).toBe('lone-skill');
      expect(result.tokenCount).toBe(42);
    });

    it('does not mutate the input array', () => {
      const a = makeSkill({ name: 'skill-a', description: 'A', tokenCount: 5 });
      const b = makeSkill({ name: 'skill-b', description: 'B', tokenCount: 5 });
      const input: ActiveSkill[] = [a, b];
      const originalCount = input.length;

      composer.compose(input);

      expect(input).toHaveLength(originalCount);
    });

    it('handles skills with zero token count', () => {
      const skill = makeSkill({ name: 'zero-cost', description: 'Zero tokens', tokenCount: 0 });

      const result = composer.compose([skill]);
      expect(result.skills).toHaveLength(1);
      expect(result.tokenCount).toBe(0);
    });
  });
});
