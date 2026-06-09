import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AgentLoader } from './loader.js';

const testDir = join(tmpdir(), 'agentsy-test-project');

describe('AgentLoader', () => {
  describe('constructor', () => {
    it('defaults to process.cwd() for projectDir', () => {
      const loader = new AgentLoader();
      expect(loader.projectDir).toBe(process.cwd());
    });

    it('accepts a custom project directory', () => {
      const loader = new AgentLoader(testDir);
      expect(loader.projectDir).toBe(testDir);
    });

    it('creates three search roots', () => {
      const loader = new AgentLoader(testDir);
      expect(loader.searchRoots).toHaveLength(3);
      expect(loader.searchRoots[0]).toBe(`${testDir}/.agents`);
    });
  });

  describe('parse', () => {
    it('parses minimal frontmatter into an AgentDefinition', () => {
      const loader = new AgentLoader();
      const content = `---
id: my-agent
name: My Agent
description: A test agent
---`;

      const def = loader.parse(content, 'user');
      expect(def.id).toBe('my-agent');
      expect(def.name).toBe('My Agent');
      expect(def.description).toBe('A test agent');
      expect(def.source).toBe('user');
    });

    it('parses all optional fields from frontmatter', () => {
      const content = `---
id: full-agent
name: Full Agent
description: Agent with everything
systemPromptTemplate: You are {{role}}.
allowedTools: [web-search, file-read]
memoryScopes: [session, workspace]
orchestrationMode: orchestrated
defaultModel: claude-sonnet-4-20250514
hooks:
  pre-turn: memory:pre-turn
  post-turn: memory:post-turn
---`;

      const def = new AgentLoader().parse(content, 'user');
      expect(def.id).toBe('full-agent');
      expect(def.systemPromptTemplate).toBe('You are {{role}}.');
      expect(def.allowedTools).toStrictEqual(['web-search', 'file-read']);
      expect(def.memoryScopes).toStrictEqual(['session', 'workspace']);
      expect(def.orchestrationMode).toBe('orchestrated');
      expect(def.defaultModel).toBe('claude-sonnet-4-20250514');
      expect(def.hooks?.['pre-turn']).toBe('memory:pre-turn');
      expect(def.hooks?.['post-turn']).toBe('memory:post-turn');
      expect(def.source).toBe('user');
    });

    it('parses wildcard allowedTools', () => {
      const content = `---
id: wild
name: Wild Agent
description: Unrestricted
allowedTools: "*"
---`;

      const def = new AgentLoader().parse(content, 'bundled');
      expect(def.allowedTools).toBe('*');
      expect(def.source).toBe('bundled');
    });

    it('handles content without frontmatter gracefully', () => {
      const content = '# Just a heading\n\nSome content without frontmatter.';
      const def = new AgentLoader().parse(content, 'user');
      expect(def.id).toBe('');
      expect(def.name).toBe('');
      expect(def.description).toBe('');
      expect(def.source).toBe('user');
    });

    it('parses boolean and numeric values in frontmatter', () => {
      const content = `---
id: bool-test
name: Bool Agent
description: Testing booleans
active: true
priority: 42
---`;

      const def = new AgentLoader().parse(content, 'user');
      // Boolean and numeric values from frontmatter aren't mapped to AgentDefinition keys,
      // but the parser should not throw
      expect(def.id).toBe('bool-test');
    });
  });

  describe('load — builtins fallback', () => {
    it('loads a built-in agent by id', async () => {
      const loader = new AgentLoader('/nonexistent/project');
      const def = await loader.load('research');
      expect(def.id).toBe('research');
      expect(def.name).toBe('Research Agent');
      expect(def.source).toBe('bundled');
    });

    it('loads the default agent from builtins', async () => {
      const loader = new AgentLoader('/nonexistent/project');
      const def = await loader.load('default');
      expect(def.id).toBe('default');
      expect(def.allowedTools).toBe('*');
      expect(def.source).toBe('bundled');
    });

    it('loads the code agent from builtins', async () => {
      const loader = new AgentLoader('/nonexistent/project');
      const def = await loader.load('code');
      expect(def.id).toBe('code');
      expect(def.orchestrationMode).toBe('orchestrated');
      expect(def.source).toBe('bundled');
    });

    it('loads the planner agent from builtins', async () => {
      const loader = new AgentLoader('/nonexistent/project');
      const def = await loader.load('plan');
      expect(def.id).toBe('plan');
      expect(def.defaultModel).toBe('claude-opus-4-20250514');
      expect(def.source).toBe('bundled');
    });

    it('throws for unknown agent id', async () => {
      const loader = new AgentLoader('/nonexistent/project');
      await expect(loader.load('nonexistent-agent')).rejects.toThrow('Agent "nonexistent-agent" not found');
    });
  });
});
