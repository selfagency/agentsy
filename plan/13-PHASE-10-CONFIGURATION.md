# Phase 10 — User Configuration & Workspace Ergonomics

**Effort:** ~10 hours  
**Milestone:** Persistent interactive configuration; XDG compliance  
**Packages:** `@agentsy/cli`, `@agentsy/plugins`  
**Gate:** Config system working; schema versioning implemented  
**Next:** Phase 11

---

## TASK-079..088: Configuration System

### TASK-079: XDG Paths

```typescript
// packages/cli/src/paths.ts
export const AGENTSY_PATHS = {
  config: process.env.XDG_CONFIG_HOME || '~/.config/agentsy',
  data: process.env.XDG_DATA_HOME || '~/.local/share/agentsy',
  cache: process.env.XDG_CACHE_HOME || '~/.cache/agentsy'
};
```

### TASK-080: Config Model + Layering

```typescript
// packages/cli/src/config/schema.ts
export const ConfigSchema = z.object({
  providers: z.array(ProviderConfigSchema),
  model: z.string().optional(),
  budget: z.object({
    inputCap: z.number(),
    outputCap: z.number()
  }),
  approvalPolicy: z.enum(['deny-all', 'deny-destructive', 'deny-none']),
  ui: z.object({
    reduceMotion: z.boolean().optional(),
    colorScheme: z.enum(['auto', 'light', 'dark']).optional()
  })
});

export async function loadConfig(): Promise<Config> {
  // Layer precedence (highest → lowest)
  const env = loadFromEnv(); // AGENTSY_*
  const project = loadFromFile('.agentsy/config.json');
  const user = loadFromFile('~/.config/agentsy/config.json');
  const defaults = DEFAULT_CONFIG;

  return deepMerge(defaults, user, project, env);
}
```

### TASK-081: Secrets Never Plaintext

```typescript
// Config structure: NO apiKey/token/password fields
export interface ProviderConfig {
  id: string;
  type: 'openai' | 'anthropic' | 'ollama';
  // secretRef: string (e.g., 'op://vault/openai/apikey')
  // OR secretId: string (credential broker ID)
}

// At runtime:
const provider = config.providers[0];
const credential = await secretsBroker.resolve(provider.secretRef);
const apiKey = credential.value; // Decrypted in-memory only
```

### TASK-082: Interactive Editor + Doctor

```bash
/config                        # Interactive editor
/settings                      # Settings wizard
/doctor                        # Diagnostic + schema migration
```

### TASK-083..088: Project Config + Schema Migration

- **Project config inheritance** — `.agentsy/config.json` in workspace (highest priority)
- **Schema versioning** — `config.version: 1` with migration runners
- **Doctor command** — Validates + upgrades schema
- **Documentation** — `packages/cli/README.md` + migration guide

---

## Plan-Only Package Promotion

### TASK-PROMOTE-MCP: @agentsy/mcp

Move from plan-only to manifest:

```typescript
// packages/mcp/package.json
{
  \"name\": \"@agentsy/mcp\",
  \"version\": \"0.1.0\",
  \"main\": \"dist/index.js\",
  \"exports\": {
    \".\": \"./dist/index.js\",
    \"./client\": \"./dist/client/index.js\"
  }
}

// packages/mcp/src/index.ts
export { createMcpClient } from './client';
export * from './types';
```

**CLI commands:**

```bash
agentsy mcp list                   # List configured servers
agentsy mcp add <uri>              # Add MCP server
agentsy mcp remove <id>            # Remove
agentsy mcp check                  # Health check all
```

### TASK-PROMOTE-GUARDRAILS: @agentsy/guardrails

**Status:** Phase 5 implementation hardened + full policy engine

- Input/output/tool guardrail pipeline ✅
- Built-in: prompt-injection, PII, secret-detection, path-sanitization, command-validation
- Custom guardrail registration
- Redaction + warning system

### TASK-PROMOTE-CONNECTORS: @agentsy/connectors

**Minimal bridge commands** (no blocking core release):

```typescript
// packages/connectors/src/
// - slack/ (message post, thread read)
// - discord/ (similar)
// - linear/ (issue creation)
// - github/ (read issues, PR ops via MCP)
```

### TASK-PROMOTE-RETRIEVAL: @agentsy/retrieval

**Complete alignment with runtime memory-retrieval contracts:**

- Query processor + hybrid retrieval ✅
- Reranking pipeline ✅
- Context builder (lost-in-middle ordering) ✅
- Chunking strategies ✅
- Source allowlist + provenance ✅

---

## Quality Gates

- ✅ Config validates against schema
- ✅ Layering precedence correct
- ✅ No plaintext secrets in config
- ✅ Schema migration tested
- ✅ All promoted packages have exports + TSDoc
- ✅ CLI commands operational

---

**Next phase:** `14-PHASE-11-INTEGRATION.md`
