import { describe, expect, it } from 'vitest';

import { TaskDecomposer } from './decomposer.js';
import type { DecomposedTaskTier } from './decomposer.js';

describe('TaskDecomposer', () => {
  describe('decompose', () => {
    it('should split a goal into tasks based on sentences', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Research the API. Implement the endpoint. Test the response.');
      expect(tasks).toHaveLength(3);
      expect(tasks[0]!.description).toContain('Research');
      expect(tasks[1]!.description).toContain('Implement');
      expect(tasks[2]!.description).toContain('Test');
    });

    it('should assign sequential dependencies by default', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('First step. Second step. Third step.');
      expect(tasks[0]!.dependencies).toEqual([]);
      expect(tasks[1]!.dependencies).toEqual(['task-0']);
      expect(tasks[2]!.dependencies).toEqual(['task-1']);
    });

    it('should assign empty dependencies when preferParallel is true', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Do A. Do B.', { preferParallel: true });
      expect(tasks[0]!.dependencies).toEqual([]);
      expect(tasks[1]!.dependencies).toEqual([]);
    });

    it('should assign estimatedTokens from tier budget', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Implement the feature.');
      // 'implement' maps to 'mid' tier → 1500 tokens
      expect(tasks[0]!.estimatedTokens).toBe(1500);
    });

    it('should cap tokens at maxTokensPerTask when provided', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Research topic.', { maxTokensPerTask: 100 });
      // 'research' maps to 'micro' tier → 500 tokens, capped at 100
      expect(tasks[0]!.estimatedTokens).toBe(100);
    });
  });

  describe('scoreTier', () => {
    it('should map "research" to micro tier', () => {
      const decomposer = new TaskDecomposer();
      // Use private-like access through decompose which calls scoreTier
      const tasks = decomposer.decompose('Research the topic.');
      expect(tasks[0]!.tier).toBe('micro');
    });

    it('should map "implement" to mid tier', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Implement the endpoint.');
      expect(tasks[0]!.tier).toBe('mid');
    });

    it('should map "plan" to frontier tier', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Plan the architecture.');
      expect(tasks[0]!.tier).toBe('frontier');
    });

    it('should map "debug" to small tier', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Debug the issue.');
      expect(tasks[0]!.tier).toBe('small');
    });
  });

  describe('extractTools', () => {
    it('should detect tool-like patterns from description', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Write the code and test it. Then deploy.');
      const tools0 = tasks[0]!.tools;
      expect(tools0).toContain('write');
      expect(tools0).toContain('test');

      const tools1 = tasks[1]!.tools;
      expect(tools1).toContain('deploy');
    });

    it('should return empty array when no tools match', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Think about the problem.');
      expect(tasks[0]!.tools).toEqual([]);
    });
  });

  describe('inferSuccessGates', () => {
    it('should map test keyword to VerificationGate', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Run tests for the module.');
      const gate = tasks[0]!.successGate;
      expect(gate).toBeDefined();
      expect(gate!.type).toBe('verification');
      if (gate?.type === 'verification') {
        expect(gate.checkId).toBe('test-pass');
        expect(gate.strategy).toBe('test-run');
      }
    });

    it('should map lint keyword to VerificationGate', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Lint the codebase.');
      const gate = tasks[0]!.successGate;
      expect(gate).toBeDefined();
      expect(gate!.type).toBe('verification');
    });

    it('should not assign a gate for unrelated descriptions', () => {
      const decomposer = new TaskDecomposer();
      const tasks = decomposer.decompose('Research the problem.');
      expect(tasks[0]!.successGate).toBeUndefined();
    });
  });
});
