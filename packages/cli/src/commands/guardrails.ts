/**
 * Guardrails CLI — manage guardrail scanner configuration and policies.
 *
 * ## Usage
 *
 * ```bash
 * agentsy guardrails list
 * agentsy guardrails install <hub-uri>
 * agentsy guardrails uninstall <hub-uri>
 * agentsy guardrails policy [path]
 * ```
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  BUILTIN_GUARDRAIL_URIS,
  createBuiltinScanners,
  GuardrailHub,
  type PolicyDocument,
  parseHubUri
} from '@agentsy/guardrails';
import type { CliIO } from '../index.js';

const defaultIo: Required<CliIO> = {
  stderr: (msg: string): void => {
    console.error(msg);
  },
  stdout: (msg: string): void => {
    console.log(msg);
  }
};

// =============================================================================
// Built-in hub registration
// =============================================================================

/**
 * Seed a hub with all built-in scanners, returning the hub.
 */
function createSeededHub(): GuardrailHub {
  const hub = new GuardrailHub();

  for (const scanner of createBuiltinScanners()) {
    const uri = scanner.metadata.id;
    hub.install(uri, scanner.constructor.name, scanner.metadata.description, () => scanner);
  }

  return hub;
}

// =============================================================================
// Subcommand handlers
// =============================================================================

interface GuardrailCliOptions {
  hub: GuardrailHub;
  json: boolean;
  noColor: boolean;
  stderr: (msg: string) => void;
  stdout: (msg: string) => void;
}

const BUILTIN_URI_VALUES: readonly string[] = Object.values(BUILTIN_GUARDRAIL_URIS);

function handleList(_argv: readonly string[], opts: GuardrailCliOptions): number {
  const entries = opts.hub.listInstalled();

  if (opts.json) {
    opts.stdout(
      JSON.stringify(
        entries.map(e => ({
          uri: e.uri,
          name: e.name,
          description: e.description,
          installedAt: e.installedAt?.toISOString()
        })),
        null,
        2
      )
    );
    return 0;
  }

  if (entries.length === 0) {
    opts.stdout('No guardrails installed.');
    return 0;
  }

  opts.stdout(`Installed guardrails (${entries.length}):`);
  opts.stdout('');
  for (const entry of entries) {
    opts.stdout(`  ${entry.uri}`);
    opts.stdout(`    Name:        ${entry.name}`);
    opts.stdout(`    Description: ${entry.description}`);
    opts.stdout(`    Installed:   ${entry.installedAt?.toISOString() ?? 'unknown'}`);
    opts.stdout('');
  }
  return 0;
}

function handleInstall(argv: readonly string[], opts: GuardrailCliOptions): number {
  const uri = argv[0];
  if (uri === undefined || uri.length === 0) {
    opts.stderr('Usage: agentsy guardrails install <hub-uri>');
    opts.stderr('');
    opts.stderr('Built-in URIs:');
    for (const builtin of BUILTIN_URI_VALUES) {
      opts.stderr(`  ${builtin}`);
    }
    return 1;
  }

  const parsed = parseHubUri(uri);
  if (parsed === null) {
    opts.stderr(`Invalid hub URI: ${uri}`);
    opts.stderr('Expected format: hub://guardrails/<name>[@version]');
    return 1;
  }

  if (opts.hub.isInstalled(uri)) {
    opts.stdout(`Already installed: ${uri}`);
    return 0;
  }

  // Try to match against known builtin scanners
  const matchKey = BUILTIN_URI_VALUES.find(u => u === uri || u.startsWith(uri.split('@')[0] ?? uri));
  if (matchKey !== undefined) {
    // Create a new hub instance seeded with builtins, then copy the matching entry
    const tempHub = createSeededHub();
    const entry = tempHub.listInstalled().find(e => e.uri === matchKey);
    if (entry) {
      opts.hub.install(uri, entry.name, entry.description, entry.factory);
      opts.stdout(`Installed: ${uri}`);
      return 0;
    }
  }

  opts.stderr(
    `Cannot resolve ${uri}. For custom scanners, implement GuardrailScanner and register via the GuardrailHub API.`
  );
  return 1;
}

function handleUninstall(argv: readonly string[], opts: GuardrailCliOptions): number {
  const uri = argv[0];
  if (uri === undefined || uri.length === 0) {
    opts.stderr('Usage: agentsy guardrails uninstall <hub-uri>');
    return 1;
  }

  if (opts.hub.uninstall(uri)) {
    opts.stdout(`Uninstalled: ${uri}`);
    return 0;
  }

  opts.stderr(`Not installed: ${uri}`);
  return 1;
}

async function handlePolicy(argv: readonly string[], opts: GuardrailCliOptions): Promise<number> {
  const filePath = argv[0] ?? './.agentsy/policy.yaml';

  if (!existsSync(filePath)) {
    opts.stderr(`Policy file not found: ${filePath}`);
    opts.stderr('Create one or run: agentsy guardrails policy <path>');
    return 1;
  }

  const raw = await readFile(filePath, 'utf-8');
  let doc: PolicyDocument;

  try {
    // Simple YAML-like parsing for flat policy documents
    doc = parseSimplePolicy(raw);
  } catch (error) {
    opts.stderr(`Invalid policy file: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  opts.stdout(`Policy: ${filePath}`);
  opts.stdout(`Version: ${doc.version}`);
  if (doc.description) {
    opts.stdout(`Description: ${doc.description}`);
  }
  opts.stdout(`Rules: ${doc.rules.length}`);
  opts.stdout('');

  if (opts.json) {
    opts.stdout(JSON.stringify(doc, null, 2));
    return 0;
  }

  for (const rule of doc.rules) {
    opts.stdout(`  ${rule.name} (${rule.action})`);
    opts.stdout(`    Condition: ${rule.condition}`);
    if (rule.description) {
      opts.stdout(`    ${rule.description}`);
    }
    opts.stdout('');
  }
  return 0;
}

// =============================================================================
// Simple YAML policy parser
// =============================================================================

/**
 * Parse a simplified YAML policy document.
 *
 * Supports the minimal subset needed for `.agentsy/policy.yaml`:
 * - `version: string`
 * - `description: string`
 * - `rules:` list with `name`, `condition`, `action`, `description`, `phase`, `severity`
 *
 * Does NOT support anchors, aliases, multi-document streams, or complex nesting.
 */
function stripOuterQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0] as string;
    const last = value.at(-1) as string;
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Internal state for line-by-line YAML policy parsing.
 */
interface PolicyParseState {
  currentRule: Record<string, string> | null;
  description: string | undefined;
  rules: Record<string, string>[];
  version: string;
}

/**
 * Patterns that can appear indented under a rule entry.
 */
const RULE_FIELD_PATTERN = /^\s+(name|condition|action|description|phase|severity):\s*([^\n]+)$/;

/**
 * Try to parse a top-level key-value line (version, description).
 * Returns true if the line was consumed as a top-level key.
 */
function tryParseTopLevel(line: string, state: PolicyParseState): boolean {
  const versionMatch = /^version:\s*([^\n]+)$/.exec(line);
  if (versionMatch) {
    const val = versionMatch[1];
    if (val !== undefined) {
      state.version = stripOuterQuotes(val.trim());
    }
    return true;
  }

  const descriptionMatch = /^description:\s*([^\n]+)$/.exec(line);
  if (descriptionMatch) {
    const val = descriptionMatch[1];
    if (val !== undefined) {
      state.description = stripOuterQuotes(val.trim());
    }
    return true;
  }

  return false;
}

/**
 * Try to parse a YAML rule entry line (- name: ... or -).
 * Returns true if the line was consumed as a rule start.
 */
function tryParseRuleStart(line: string, state: PolicyParseState): boolean {
  if (!(line.trim() === '-' || /^\s*-\s+name:/.test(line))) {
    return false;
  }

  if (state.currentRule !== null) {
    state.rules.push(state.currentRule);
  }
  state.currentRule = {};

  const nameMatch = /^\s*-\s+name:\s*([^\n]+)$/.exec(line);
  if (nameMatch) {
    const val = nameMatch[1];
    if (val !== undefined) {
      state.currentRule.name = stripOuterQuotes(val.trim());
    }
  }

  return true;
}

/**
 * Try to parse indented field lines under a rule entry (e.g., "  action: deny").
 */
function tryParseRuleField(line: string, state: PolicyParseState): void {
  if (state.currentRule === null) {
    return;
  }

  const fieldMatch = RULE_FIELD_PATTERN.exec(line);
  if (!fieldMatch) {
    return;
  }

  const key = fieldMatch[1] as string;
  const val = fieldMatch[2] as string;
  if (val !== undefined) {
    state.currentRule[key] = stripOuterQuotes(val.trim());
  }
}

export function parseSimplePolicy(raw: string): PolicyDocument {
  const lines = raw.split('\n');
  const state: PolicyParseState = {
    rules: [],
    currentRule: null,
    version: '1.0',
    description: undefined
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    // Try each parser in order
    if (tryParseTopLevel(line, state)) {
      continue;
    }
    if (tryParseRuleStart(line, state)) {
      continue;
    }
    tryParseRuleField(line, state);
  }

  // Push the final rule if one is in progress
  if (state.currentRule !== null) {
    state.rules.push(state.currentRule);
  }

  return {
    version: state.version,
    ...(state.description ? { description: state.description } : {}),
    rules: state.rules.map(r => {
      const rule: Record<string, string> & { phase?: string; severity?: string } = { ...r };
      return {
        name: rule.name ?? 'unnamed',
        condition: rule.condition ?? '',
        action: validateAction(rule.action ?? 'deny'),
        ...(rule.description ? { description: rule.description } : {}),
        ...(rule.phase ? { phase: rule.phase as 'input' | 'output' | 'tool-input' | 'tool-output' } : {}),
        ...(rule.severity ? { severity: rule.severity as 'low' | 'medium' | 'high' | 'critical' } : {})
      };
    })
  };
}

function validateAction(action: string): 'deny' | 'require_approval' | 'allow' | 'log' | 'redact' {
  const valid = ['deny', 'require_approval', 'allow', 'log', 'redact'] as const;
  if ((valid as readonly string[]).includes(action)) {
    return action as 'deny' | 'require_approval' | 'allow' | 'log' | 'redact';
  }
  return 'deny';
}

// =============================================================================
// Entry point
// =============================================================================

export async function runGuardrailsCommand(argv: readonly string[], io: CliIO = defaultIo): Promise<number> {
  const subcommand = argv[0];
  const rest = argv.slice(1);
  const hub = createSeededHub();
  const json = argv.includes('--json');
  const noColor = argv.includes('--no-color');
  const stdout = io.stdout ?? defaultIo.stdout;
  const stderr = io.stderr ?? defaultIo.stderr;
  const opts: GuardrailCliOptions = { hub, json, noColor, stdout, stderr };

  if (subcommand === 'list') {
    return handleList(rest, opts);
  }

  if (subcommand === 'install') {
    return handleInstall(rest, opts);
  }

  if (subcommand === 'uninstall') {
    return handleUninstall(rest, opts);
  }

  if (subcommand === 'policy') {
    return await handlePolicy(rest, opts);
  }

  stderr(`Unknown guardrail subcommand: ${subcommand ?? '(none)'}`);
  stderr('Supported: list, install, uninstall, policy');
  return 1;
}
