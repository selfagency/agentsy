/**
 * Agent loader — discovers and parses AgentDefinition from filesystem or builtins.
 *
 * Search order (first match wins):
 * 1. `<project>/.agents/<agentId>.md`
 * 2. `~/.agents/<agentId>.md`
 * 3. `~/.config/agentsy/agents/<agentId>.md`
 * 4. Built-in agent definitions
 *
 * @module @agentsy/plugins/agents
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { BUILTIN_AGENT_DEFINITIONS } from './builtins.js';
import type { AgentDefinition, AgentDefinitionSource, AgentOrchestrationMode } from './definition.js';

/**
 * Parsed frontmatter result.
 */
interface FrontmatterResult {
  /** Body content after the frontmatter block. */
  body: string;
  /** Parsed key-value pairs from the frontmatter block. */
  data: Record<string, unknown>;
}

/**
 * Minimal YAML-ish frontmatter parser.
 *
 * Expects content to start with `---` on its own line, followed by
 * `key: value` pairs, and a closing `---` line.  Returns an empty
 * data object when no frontmatter is detected.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: frontmatter parser has many field types
function parseFrontmatter(content: string): FrontmatterResult {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith('---')) {
    return { data: {}, body: trimmed };
  }

  const endIndex = trimmed.indexOf('\n---', 3);

  if (endIndex === -1) {
    return { data: {}, body: trimmed };
  }

  const raw = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 4).trim();
  const data = Object.create(null) as Record<string, unknown>;

  const lines = raw.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    if (!key) {
      continue;
    }

    let value: unknown = line.slice(colonIndex + 1).trim();

    if (value === '') {
      const objectValue: Record<string, string> = {};
      let lookahead = index + 1;

      while (lookahead < lines.length) {
        const nestedLine = lines[lookahead];
        if (nestedLine === undefined || !nestedLine.startsWith('  ')) {
          break;
        }

        const nestedColon = nestedLine.indexOf(':');
        if (nestedColon !== -1) {
          const nestedKey = nestedLine.slice(0, nestedColon).trim();
          const nestedValue = nestedLine
            .slice(nestedColon + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
          objectValue[nestedKey] = nestedValue;
        }

        lookahead += 1;
      }

      if (Object.keys(objectValue).length > 0) {
        data[key] = objectValue;
        index = lookahead - 1;
        continue;
      }
    }

    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      const items = inner
        .split(',')
        .map(i => i.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);

      value = items.length > 0 ? items : [];
    }

    if (typeof value === 'string') {
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (value === '*') {
        value = '*';
      } else if (/^\d+$/.test(value)) {
        value = Number(value);
      } else if (/^\d+\.\d+$/.test(value)) {
        value = Number(value);
      } else {
        value = value.replace(/^["']|["']$/g, '');
      }
    }

    data[key] = value;
  }

  return { data, body };
}

/**
 * Converts a key-value map into a partial {@link AgentDefinition}.
 *
 * Only recognised keys are mapped; unknown keys are silently ignored.
 */
function coerceToDefinition(data: Record<string, unknown>, source: AgentDefinitionSource): AgentDefinition {
  let allowedTools: AgentDefinition['allowedTools'];
  if (data.allowedTools === '*') {
    allowedTools = '*';
  } else if (Array.isArray(data.allowedTools)) {
    allowedTools = data.allowedTools as string[];
  } else {
    allowedTools = undefined;
  }

  const memoryScopes = Array.isArray(data.memoryScopes)
    ? (data.memoryScopes as AgentDefinition['memoryScopes'])
    : undefined;

  const definition: AgentDefinition = {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    source
  };

  if (data.systemPromptTemplate) {
    definition.systemPromptTemplate = String(data.systemPromptTemplate);
  }

  if (allowedTools !== undefined) {
    definition.allowedTools = allowedTools;
  }

  if (memoryScopes !== undefined) {
    definition.memoryScopes = memoryScopes;
  }

  if (data.orchestrationMode) {
    definition.orchestrationMode = data.orchestrationMode as AgentOrchestrationMode;
  }

  if (data.defaultModel) {
    definition.defaultModel = String(data.defaultModel);
  }

  if (data.hooks && typeof data.hooks === 'object') {
    definition.hooks = data.hooks as Record<string, string>;
  }

  return definition;
}

/**
 * Discovers and loads {@link AgentDefinition}s from filesystem locations
 * and built-in manifests.
 */
export class AgentLoader {
  readonly projectDir: string;
  /** Filesystem search roots for external agent definitions. */
  readonly searchRoots: string[];

  /**
   * @param projectDir - Project root directory. Used to construct
   *   `<project>/.agents/` search path. Defaults to `process.cwd()`.
   */
  constructor(projectDir?: string) {
    this.projectDir = projectDir ?? process.cwd();
    this.searchRoots = [
      resolve(this.projectDir, '.agents'),
      resolve(homedir(), '.agents'),
      resolve(homedir(), '.config', 'agentsy', 'agents')
    ];
  }

  /**
   * Load an agent definition by its identifier.
   *
   * Search order (first match wins):
   * 1. `<project>/.agents/<agentId>.md`
   * 2. `~/.agents/<agentId>.md`
   * 3. `~/.config/agentsy/agents/<agentId>.md`
   * 4. Built-in agent definitions (bundled)
   *
   * @param agentId - Agent identifier (e.g. `'research'`, `'plan'`).
   * @returns The resolved agent definition.
   * @throws When the agent cannot be found in any location.
   */
  async load(agentId: string): Promise<AgentDefinition> {
    // Filesystem search (directories with <agentId>.md)
    for (const root of this.searchRoots) {
      const filePath = resolve(root, `${agentId}.md`);

      try {
        const content = await readFile(filePath, 'utf-8');
        const { data } = parseFrontmatter(content);
        const source: AgentDefinitionSource =
          root.includes('.config/agentsy') || root.includes(homedir()) ? 'user' : 'workspace';

        return coerceToDefinition({ ...data, id: data.id ?? agentId }, source);
      } catch {
        // Not found or unreadable — continue to next root
      }
    }

    // Fallback to built-in
    const builtin = BUILTIN_AGENT_DEFINITIONS.find(a => a.id === agentId);

    if (builtin) {
      return builtin;
    }

    throw new Error(`Agent "${agentId}" not found in any search location or builtins`);
  }

  /**
   * Parse an AGENT.md string into an {@link AgentDefinition}.
   *
   * @param content - Raw markdown content with YAML frontmatter.
   * @param source - Origin label (default: `'user'`).
   * @returns The parsed definition.
   */
  parse(content: string, source: AgentDefinitionSource = 'user'): AgentDefinition {
    const { data } = parseFrontmatter(content);

    return coerceToDefinition(data, source);
  }
}
