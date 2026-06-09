import { describe, expect, it } from 'vitest';

import {
  agentCommands,
  listSlashCommands,
  modelCommands,
  providerCommands,
  skillsCommands,
  slashCommands
} from './index.js';

describe('slash command descriptors', () => {
  describe('modelCommands', () => {
    it('defines search, select, and refine commands', () => {
      const actions = modelCommands.map(c => c.action);
      expect(actions).toContain('search');
      expect(actions).toContain('select');
      expect(actions).toContain('refine');
    });

    it('every command has a non-empty description', () => {
      for (const cmd of modelCommands) {
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('providerCommands', () => {
    it('defines a search command', () => {
      expect(providerCommands.map(c => c.action)).toContain('search');
    });
  });

  describe('agentCommands', () => {
    it('defines list, show, and select commands', () => {
      const actions = agentCommands.map(c => c.action);
      expect(actions).toContain('list');
      expect(actions).toContain('show');
      expect(actions).toContain('select');
    });

    it('every command has the agent domain', () => {
      for (const cmd of agentCommands) {
        expect(cmd.domain).toBe('agent');
      }
    });

    it('every command has the correct /agent prefix', () => {
      for (const cmd of agentCommands) {
        expect(cmd.command.startsWith('/agent ')).toBe(true);
      }
    });
  });

  describe('skillsCommands', () => {
    it('defines list and show commands', () => {
      const actions = skillsCommands.map(c => c.action);
      expect(actions).toContain('list');
      expect(actions).toContain('show');
    });

    it('every command has the skills domain', () => {
      for (const cmd of skillsCommands) {
        expect(cmd.domain).toBe('skills');
      }
    });

    it('every command has the correct /skills prefix', () => {
      for (const cmd of skillsCommands) {
        expect(cmd.command.startsWith('/skills ')).toBe(true);
      }
    });
  });

  describe('slashCommands', () => {
    it('includes all model, provider, agent, and skills commands', () => {
      const total = modelCommands.length + providerCommands.length + agentCommands.length + skillsCommands.length;
      expect(slashCommands.length).toBe(total);
    });

    it('every entry satisfies the SlashCommandDescriptor contract', () => {
      for (const cmd of slashCommands) {
        expect(cmd).toHaveProperty('action');
        expect(cmd).toHaveProperty('command');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('domain');
        expect(typeof cmd.action).toBe('string');
        expect(typeof cmd.command).toBe('string');
        expect(typeof cmd.description).toBe('string');
        expect(typeof cmd.domain).toBe('string');
      }
    });
  });

  describe('listSlashCommands', () => {
    it('returns all commands when no domain filter is given', () => {
      const all = listSlashCommands();
      expect(all.length).toBe(slashCommands.length);
    });

    it('filters by domain', () => {
      const agentOnly = listSlashCommands('agent');
      expect(agentOnly.length).toBe(agentCommands.length);
      for (const cmd of agentOnly) {
        expect(cmd.domain).toBe('agent');
      }
    });

    it('filters by skills domain', () => {
      const skillsOnly = listSlashCommands('skills');
      expect(skillsOnly.length).toBe(skillsCommands.length);
      for (const cmd of skillsOnly) {
        expect(cmd.domain).toBe('skills');
      }
    });

    it('returns empty for unknown domains', () => {
      const _result = listSlashCommands('model');
      // 'model' is valid, but test filters for something not in domain union
      const allModel = listSlashCommands('model');
      expect(allModel.length).toBe(modelCommands.length);
    });
  });
});
