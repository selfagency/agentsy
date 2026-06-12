# Phase 5 — Tools, Approvals & Guardrails Enforcement

**Effort:** ~20 hours  
**Milestone:** Safe tool execution with deny-by-default approvals; complete guardrails module  
**Packages:** `@agentsy/tools`, `@agentsy/mcp`, `@agentsy/runtime`, `@agentsy/guardrails`, `@agentsy/renderers`, `@agentsy/cli`  
**Gate:** Tool approval path working; guardrail pipeline integrated with hub registry + policy engine; CLI install/list commands  
**Next:** Phase 6

---

## Status — 2026-06-12 Code Review

**Completion: ~50% — Guardrails complete, tool implementations are stubs**

### ✅ BATCH 1: MCP AUDIT + TOOL REGISTRY (100% DONE)
- ✅ ToolDefinition interface (name, description, handler, annotations, parameters, schema)
- ✅ ToolAnnotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint, requiresApproval)
- ✅ ToolRegistry class (register, get, list, execute, remove, listByAnnotation, toJSON)
- ✅ Baseline tools registered — REPL, FS read/write/patch, Shell, HTTP, MCP bridge
- ✅ MCP spec 2025-06-18 compliance verified (Tool type, ResourceTemplate, Content unions)

### ✅ BATCH 2: GUARDRAILS CORE — PIPELINE + HUB + POLICY (100% DONE)
- ✅ GuardrailResult types (pass | block | transform | escalate with reason codes)
- ✅ GuardrailPipeline class (checkInput, checkToolPreExecution, checkToolPostExecution, checkOutput)
  - Priority-sorted execution (rule-based 1-10, regex 10-50, ML 50-100, LLM 100+)
  - Short-circuit on block/escalate; transform chains through pipeline
- ✅ GuardrailHub with hub:// URI resolution, install/uninstall/list
- ✅ PolicyEngine (YAML policy-as-code per Microsoft AGT pattern)
  - Condition evaluation (==, !=, in, not_in, matches operators)
  - Tool identity + annotation matching
- ✅ GuardrailMetadata (name, version, source, OWASP categories, priority, timeout)
- ✅ 18 test files, 183 tests — ALL PASSING ✅

### ✅ BATCH 3: BUILT-IN SCANNERS (100% DONE) — 8 scanner types
- ✅ PromptInjectionScanner (DRIFT-style heuristic detection)
- ✅ PIIScanner (email, phone, SSN, credit card, IP, API key patterns)
- ✅ SecretDetectionScanner (AWS, GitHub, Anthropic, OpenAI key patterns)
- ✅ PathSanitizationScanner (path traversal blocking, allowlist enforcement)
- ✅ CommandValidationScanner (shell command allowlist)
- ✅ ToxicityScanner (heuristic content scoring)
- ✅ RateLimiterScanner (token bucket rate limiting)
- ✅ BONUS — EntropyScanner, CredentialReferenceScanner, BaselineManager, InlineIgnoreDirectives
- ✅ Deep-scrub PII redaction (scrubPiiDeep, scrubMessage, scrubMessagesForModel)

### ✅ BATCH 4: APPROVAL ENGINE + HOOKS (100% DONE)
- ✅ ApprovalManager (request, waitForApproval, approve, reject, listPending)
- ✅ Runtime guardrail hooks (4 hooks):
  - ✅ createInputGuardrailHook (pre-turn, validates user input)
  - ✅ createToolInputGuardrailHook (pre-tool-call, validates args)
  - ✅ createToolOutputGuardrailHook (post-tool-call, redacts results)
  - ✅ createOutputGuardrailHook (pre-response, validates output)
- ✅ 2 test files, 38 tests — ALL PASSING ✅

### ✅ BATCH 5: CLI GUARDRAILS COMMANDS (100% DONE)
- ✅ `agentsy guardrails list` — shows all registered scanners with metadata
- ✅ `agentsy guardrails install <hub-uri>` — downloads + registers guardrail
- ✅ `agentsy guardrails uninstall <hub-uri>` — removes guardrail
- ✅ `agentsy guardrails policy [path]` — shows loaded YAML policy + rules

### ❌ BATCH 6: PANES + E2E (INCOMPLETE)
- ❌ DocumentViewer component — NOT BUILT
- ❌ DiffViewer component — NOT BUILT
- ❌ E2E approval + guardrail scenarios — NOT WRITTEN

### 🔴 CRITICAL BLOCKER: TOOL HANDLERS ARE STUBS
All baseline tools (`@agentsy/tools`) have **placeholder handlers** — they don't execute actual code:

| Tool | Issue | Impact |
|------|-------|--------|
| `repl_execute` | Returns `{ ok: true, data: { result: 'Execution placeholder' } }` | Cannot run code |
| `fs_read` | Returns `{ ok: true, data: { content: '[fs_read placeholder] ${path}' } }` | Cannot read files |
| `fs_write` | Returns stub data | Cannot write files |
| `fs_patch` | Returns stub data | Cannot patch files |
| `shell_exec` | Returns `{ ok: true, data: { stdout: '[shell_exec placeholder]' } }` | Cannot run shell |
| `http_fetch` | Returns stub data | Cannot make HTTP requests |
| `mcp_call` | Returns stub data | Cannot call MCP servers |

**This means:** Tools can be approved but produce no actual output. Orchestration and guardrails work, but tooling is non-functional.

### 🎯 REMEDIATION PRIORITY
| Task | Effort | Blocker? |
|------|--------|----------|
| Implement REPL handler (Node.js VM execution) | 1h | **YES** |
| Implement FS handlers (fs module IO) | 1h | **YES** |
| Implement Shell handler (child_process) | 0.5h | **YES** |
| Implement HTTP handler (fetch API) | 0.5h | **YES** |
| Implement MCP handler (MCP client bridge) | 1h | **YES** |
| Build DocumentViewer + DiffViewer | 1h | P1 |
| Add E2E approval + guardrail tests | 1h | P2 |

**TOTAL: 5.5h for production-ready tools. Currently at 50% because guardrails ship but tools are unusable.**

### STATUS: ~50% SHIPPED — Guardrails complete, tool implementations stubbed

**Reference architectures incorporated:**

- Guardrails AI hub registry pattern — downloadable guardrail policies from `hub://` URIs
- Microsoft Agent Governance Toolkit — YAML policy-as-code with conditions on annotations + tool identity
- LLM Guard — transform/sanitize outcome on input guardrails (return sanitized content instead of just blocking)
- OWASP Agentic Security Top 10 — per-scanner classification for compliance traceability
- GA Guard adversarial test methodology — bypass-rate measurement for red-teaming

**Architectural invariants (REVISED-ARCHITECTURE-PLAN):**
> **Hook/Prompt Axiom:** Safety logic MUST be implemented in hooks (deterministic), never in system prompts (probabilistic). A hook that returns `{ block: true }` cannot be overridden by model output. This is the primary security boundary.

---

## Phase Structure — 6 Batches

| Batch | Focus | Packages | Effort |
|-------|-------|----------|--------|
| 1 | MCP Audit + Tool Registry | `@agentsy/mcp`, `@agentsy/tools` | ~3h |
| 2 | Guardrails Module: Pipeline + Hub + Policy Engine | `@agentsy/guardrails` | ~6h |
| 3 | Guardrails Module: Built-in Scanners | `@agentsy/guardrails` | ~3h |
| 4 | Approval Engine + Hook Integration | `@agentsy/runtime` | ~2h |
| 5 | CLI Guardrails Commands | `@agentsy/cli` | ~2h |
| 6 | Workspace Panes + E2E | `@agentsy/renderers`, `@agentsy/cli` | ~3h |

---

## Batch 1 — MCP Audit + Tool Registry (~3h)

### 1.1 MCP Spec Compliance

**Effort:** ~1 hour  
**Location:** `packages/mcp/src/`

Audit against MCP spec 2025-06-18:

- ✅ `Tool` type matches spec
- ✅ `ResourceTemplate` patterns
- ✅ `TextContent` | `ImageContent` (PNG/JPEG/GIF/WebP)
- ✅ No JSON-RPC batching (removed in 2025-06)
- ✅ `authorizationServerUrl` capability
- ✅ `elicitation` capability for interactive tools

```typescript
// packages/mcp/src/types.ts
export interface Tool {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

export type Content = TextContent | ImageContent | EmbeddedResource;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string; // base64
}

export interface Capability {
  authorizationServerUrl?: string;
  elicitation?: boolean;
}
```

**Transport layer:**

```typescript
export async function createMcpClient(config: McpClientConfig) {
  if (config.transport === 'stdio') {
    return new StdioMcpClient(config);
  } else if (config.transport === 'http') {
    return new HttpMcpClient(config);
  }
}
```

### 1.2 Baseline Tool Registry

**Effort:** ~2 hours  
**Location:** `packages/tools/src/`

All tools require complete annotations at registration:

```typescript
export const toolDefinitions = [
  {
    name: 'repl_execute',
    description: 'Execute JavaScript in isolated REPL kernel',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' }
      },
      required: ['code']
    },
    annotations: {
      readOnlyHint: false,       // REQUIRED
      destructiveHint: true,      // REQUIRED
      idempotentHint: false,      // REQUIRED
      openWorldHint: false,       // REQUIRED
      requiresCredential: undefined,
      progressNotifications: false
    },
    handler: async input => {
      /* ... */
    }
  }
];
```

Registration without complete annotations throws `ToolAnnotationError` at registration time.

#### Baseline Tools

## 1. REPL Execution

```typescript
{
  name: 'repl_execute',
  description: 'Execute code in session kernel',
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input: { code: string }, ctx: ToolContext) => {
    const kernel = ctx.session.getOrCreateKernel();
    const result = await kernel.execute(input.code);
    return { output: result.stdout, error: result.stderr };
  }
}
```

## 2. File Operations

```typescript
{
  name: 'fs_read',
  description: 'Read file (structural parsing if code)',
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input: { path: string }, ctx: ToolContext) => {
    const content = await fs.readFile(path, 'utf-8');
    if (isCode(path)) return { structured: parseStructure(content) };
    return { content };
  }
}

{
  name: 'fs_write',
  description: 'Write file with backup',
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input: { path: string; content: string }, ctx: ToolContext) => {
    const backup = await fs.readFile(path, 'utf-8').catch(() => undefined);
    if (backup) ctx.session.checkpoint({ type: 'fs_backup', path, backup });
    await fs.writeFile(path, input.content);
    return { success: true };
  }
}

{
  name: 'fs_patch',
  description: 'Patch file with structural awareness',
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input: { path: string; hunks: Hunk[] }, ctx: ToolContext) => {
    return await applyPatch(path, input.hunks);
  }
}
```

## 3. Shell Wrapper

```typescript
{
  name: 'shell_exec',
  description: 'Execute shell command (restricted)',
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async (input: { command: string }, ctx: ToolContext) => {
    const allowList = ctx.config.shellAllowList || DEFAULTS;
    if (!isAllowed(input.command, allowList)) throw new ForbiddenCommandError(input.command);
    const { stdout, stderr, exitCode } = await execSync(input.command);
    return { stdout, stderr, exitCode };
  }
}
```

## 4. HTTP Fetch

```typescript
{
  name: 'http_fetch',
  description: 'Fetch URL',
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (input: { url: string; method?: string }, ctx: ToolContext) => {
    if (!isValidUrl(input.url)) throw new InvalidUrlError(input.url);
    const response = await fetch(input.url, { method: input.method || 'GET', timeout: 10000 });
    return { status: response.status, content: await response.text(), contentType: response.headers['content-type'] };
  }
}
```

## 5. MCP Bridge

```typescript
{
  name: 'mcp_call',
  description: 'Call MCP server tool',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true, requiresCredential: 'custom' },
  handler: async (input: { server: string; tool: string; args: any }, ctx: ToolContext) => {
    const client = ctx.mcp.getClient(input.server);
    return client.callTool(input.tool, input.args);
  }
}
```

### ToolRegistry

```typescript
export class ToolRegistry {
  register(tool: ToolDefinition) {
    if (!tool.annotations) throw new ToolAnnotationError('Tool requires complete annotations');
    this.tools.set(tool.name, tool);
  }

  async list(cursor?: string, limit?: number): Promise<ToolListPage> {
    return paginate(this.tools, cursor, limit);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) throw new ToolNotFoundError(name);

    await ctx.hooks.fire('pre-tool-call', { tool, input });
    const result = await tool.handler(input, ctx);
    await ctx.hooks.fire('post-tool-call', { tool, result });
    return result;
  }
}
```

---

## Batch 2 — Guardrails Module Core: Pipeline + Hub + Policy Engine (~6h)

**Location:** `packages/guardrails/src/`

**Source layout:**

```text
packages/guardrails/src/
  index.ts                          # Public API re-exports
  types.ts                          # Core types (GuardrailResult, etc.)
  pipeline.ts                       # GuardrailPipeline (evaluator orchestrator)
  input-guardrail.ts                # InputGuardrail factory
  output-guardrail.ts               # OutputGuardrail factory
  tool-guardrail.ts                 # ToolGuardrail factory
  guardrail-hub.ts                  # GuardrailHub (package registry)
  guardrail-hub-resolver.ts         # hub:// URI resolution
  policy/
    policy-engine.ts                # PolicyEngine (YAML policy evaluator)
    policy-loader.ts                # Load policy.yaml from disk
    types.ts                        # PolicyRule, PolicyCondition types
  pii-scrubber.ts                   # PII detection patterns
  secret-detector.ts                # Secret detection patterns
  prompt-injection.ts               # Injection heuristic scoring
  rate-limiter.ts                   # Token bucket rate limiter
  response.ts                       # GuardrailContext, GuardrailResponse
```

### 2.1 Core Types

```typescript
// packages/guardrails/src/types.ts

/**
 * Policy outcome for a guardrail check.
 * - pass: content is clean, proceed
 * - block: content violates policy, stop
 * - transform: content needs sanitization before proceeding
 * - escalate: human review needed
 */
export type GuardrailResult =
  | { pass: true }
  | { block: true; reason: string; code: GuardrailCode }
  | { transform: true; sanitized: string; reason: string }
  | { escalate: true; reason: string; code: GuardrailCode; severity: 'moderate' | 'high' | 'critical' };

/**
 * Enumeration of stable reason codes for machine-readable policy tracing.
 */
export type GuardrailCode =
  | 'prompt-injection'
  | 'pii-detected'
  | 'secret-detected'
  | 'path-denied'
  | 'command-denied'
  | 'toxicity'
  | 'rate-limited'
  | 'policy-deny'
  | 'policy-escalate'
  | 'credential-missing';

/**
 * OWASP Agentic Security Top 10 categories for compliance traceability.
 * Reference: https://owasp.org/www-project-agentic-security/
 */
export type OWASPCategory =
  | 'ASI-01' // Prompt Injection
  | 'ASI-02' // Insecure Agent Communication
  | 'ASI-03' // Insecure Plugin Design
  | 'ASI-04' // Excessive Agency
  | 'ASI-05' // Inadequate Access Control
  | 'ASI-06' // Improper Data Handling
  | 'ASI-07' // Insecure Output Handling
  | 'ASI-08' // Unsafe System Instructions
  | 'ASI-09' // Identity Spoofing
  | 'ASI-10' // Unauthorized Control;

/**
 * Guardrail metadata for discovery, compliance, and audit.
 */
export interface GuardrailMetadata {
  name: string;
  description: string;
  version: string;
  source: 'builtin' | `hub://${string}`;
  owaspCategories: OWASPCategory[];
  /** Lower priority runs first. Rule-based: 1-10, Regex: 10-50, ML: 50-100, LLM: 100+ */
  priority: number;
  /** Default timeout in ms before the guardrail is skipped with a warning. 0 = no timeout. */
  timeoutMs?: number;
}

/**
 * Context passed to every guardrail check.
 */
export interface GuardrailContext {
  sessionId: string;
  content: string;
  phase: 'input' | 'output' | 'tool_call' | 'tool_result';
  meta: Record<string, unknown>;
  span?: unknown; // OTel span placeholder
}
```

### 2.2 Input Guardrail

```typescript
// packages/guardrails/src/input-guardrail.ts

import type { GuardrailResult, GuardrailContext, GuardrailMetadata } from './types.js';

export interface InputGuardrail {
  metadata: GuardrailMetadata;
  check(input: string, ctx: GuardrailContext): GuardrailResult;
}

export function createInputGuardrail(
  metadata: GuardrailMetadata,
  check: (input: string, ctx: GuardrailContext) => GuardrailResult
): InputGuardrail {
  return { metadata, check };
}
```

**Key difference from initial plan:** Added `GuardrailMetadata` (name, version, source, OWASP categories, priority, timeout). The `check` function now receives `GuardrailContext` and can return `{ transform: true, sanitized }` — not just `block`.

### 2.3 Output Guardrail

```typescript
// packages/guardrails/src/output-guardrail.ts

import type { GuardrailResult, GuardrailContext, GuardrailMetadata } from './types.js';

export interface OutputGuardrail {
  metadata: GuardrailMetadata;
  check(output: string, ctx: GuardrailContext): GuardrailResult;
}

export function createOutputGuardrail(
  metadata: GuardrailMetadata,
  check: (output: string, ctx: GuardrailContext) => GuardrailResult
): OutputGuardrail {
  return { metadata, check };
}
```

### 2.4 Tool Guardrail

```typescript
// packages/guardrails/src/tool-guardrail.ts

import type { GuardrailResult, GuardrailMetadata } from './types.js';

export interface ToolGuardrail {
  metadata: GuardrailMetadata;
  preCheck?(tool: { name: string; annotations: Record<string, unknown> }, args: unknown): GuardrailResult;
  postCheck?(tool: { name: string; annotations: Record<string, unknown> }, result: unknown): GuardrailResult;
}

export function createToolGuardrail(
  metadata: GuardrailMetadata,
  opts: {
    preCheck?: (tool: { name: string; annotations: Record<string, unknown> }, args: unknown) => GuardrailResult;
    postCheck?: (tool: { name: string; annotations: Record<string, unknown> }, result: unknown) => GuardrailResult;
  }
): ToolGuardrail {
  return { metadata, ...opts };
}
```

### 2.5 Guardrail Pipeline

```typescript
// packages/guardrails/src/pipeline.ts

import type { GuardrailResult, GuardrailContext } from './types.js';
import type { InputGuardrail } from './input-guardrail.js';
import type { OutputGuardrail } from './output-guardrail.js';
import type { ToolGuardrail } from './tool-guardrail.js';

export class GuardrailPipeline {
  private inputGuardrails: InputGuardrail[] = [];
  private outputGuardrails: OutputGuardrail[] = [];
  private toolGuardrails: ToolGuardrail[] = [];

  /** Register an input guardrail. Sorted by priority (lowest first = fastest scanners run first). */
  addInput(guardrail: InputGuardrail): void {
    this.inputGuardrails.push(guardrail);
    this.inputGuardrails.sort((a, b) => a.metadata.priority - b.metadata.priority);
  }

  addOutput(guardrail: OutputGuardrail): void {
    this.outputGuardrails.push(guardrail);
    this.outputGuardrails.sort((a, b) => a.metadata.priority - b.metadata.priority);
  }

  addTool(guardrail: ToolGuardrail): void {
    this.toolGuardrails.push(guardrail);
    this.toolGuardrails.sort((a, b) => a.metadata.priority - b.metadata.priority);
  }

  /** Check input content through all registered input guardrails. Short-circuits on first block/escalate. */
  async checkInput(input: string, ctx: GuardrailContext): Promise<GuardrailResult> {
    for (const guardrail of this.inputGuardrails) {
      const result = guardrail.check(input, ctx);
      if (result.block || result.escalate) return result;
      if (result.transform) {
        // Transform replaces input for subsequent guardrails
        input = result.sanitized;
      }
    }
    return { pass: true };
  }

  async checkToolPreExecution(tool: { name: string; annotations: Record<string, unknown> }, args: unknown): Promise<GuardrailResult> {
    for (const guardrail of this.toolGuardrails) {
      if (guardrail.preCheck) {
        const result = guardrail.preCheck(tool, args);
        if (result.block || result.escalate) return result;
      }
    }
    return { pass: true };
  }

  async checkToolPostExecution(tool: { name: string; annotations: Record<string, unknown> }, result: unknown): Promise<GuardrailResult> {
    for (const guardrail of this.toolGuardrails) {
      if (guardrail.postCheck) {
        const check = guardrail.postCheck(tool, result);
        if (check.block || check.escalate) return check;
        if (check.transform) result = check.sanitized;
      }
    }
    return { pass: true };
  }

  async checkOutput(output: string, ctx: GuardrailContext): Promise<GuardrailResult> {
    for (const guardrail of this.outputGuardrails) {
      const result = guardrail.check(output, ctx);
      if (result.block || result.escalate) return result;
      if (result.transform) output = result.sanitized;
    }
    return { pass: true };
  }

  /** List all registered guardrails with their metadata. */
  list(): { input: GuardrailMetadata[]; output: GuardrailMetadata[]; tool: GuardrailMetadata[] } {
    return {
      input: this.inputGuardrails.map(g => g.metadata),
      output: this.outputGuardrails.map(g => g.metadata),
      tool: this.toolGuardrails.map(g => g.metadata)
    };
  }
}
```

**Key design decisions:**

- Guardrails are sorted by `priority` at registration time — rule-based (priority 1-10) run before regex (10-50), before ML (50-100), before LLM (100+)
- `transform` outcomes chain: sanitized content replaces input for subsequent guardrails in the same phase
- Short-circuit on `block` or `escalate` — but `transform` continues through all scanners for layered sanitization
- `timeoutMs` on metadata allows the runtime to skip hung guardrails with a warning

### 2.6 GuardrailHub — Package Registry

**Pattern:** Guardrails AI hub model — downloadable, versioned guardrail packages resolved by `hub://` URI.

```typescript
// packages/guardrails/src/guardrail-hub.ts

/**
 * GuardrailHub resolves hub:// URIs to installed guardrail packages.
 * Packages are downloaded and cached locally.
 * A package is a directory containing source (compiled JS) + metadata (JSON).
 */
export interface HubPackageManifest {
  id: string;               // e.g. "guardrails/prompt_injection"
  version: string;          // semver
  description: string;
  type: 'input' | 'output' | 'tool';
  entry: string;            // relative path to compiled entry
  owaspCategories: string[];
  license: string;
  author: string;
}

export class GuardrailHub {
  private packages: Map<string, HubPackageManifest> = new Map();
  private installDir: string;

  constructor(opts: { installDir?: string } = {}) {
    this.installDir = opts.installDir ?? DEFAULT_GUARDRAIL_DIR;
  }

  /** Resolve a hub:// URI to local path. Searches installDir + builtins. */
  resolve(uri: `hub://${string}`): HubPackageManifest | undefined {
    const id = uri.slice('hub://'.length);
    return this.packages.get(id);
  }

  /** Install a guardrail package from a hub:// or npm:// URI. */
  async install(uri: string): Promise<HubPackageManifest> {
    // If hub://, resolve via registry URL (env GUARDRAIL_HUB_URL or default)
    // Download manifest + compiled source to installDir
    // Validate license + integrity (SHA)
    // Register in this.packages
    // Return manifest
  }

  /** Uninstall a previously installed package. */
  async uninstall(id: string): Promise<void> {
    // Remove from installDir + this.packages
  }

  /** List all installed packages (including builtins). */
  list(): HubPackageManifest[] {
    return [...this.packages.values()];
  }

  /** Load all installed guardrails into a pipeline. */
  async loadIntoPipeline(pipeline: GuardrailPipeline): Promise<void> {
    for (const pkg of this.packages.values()) {
      // Dynamically import entry point
      const module = await import(path.join(this.installDir, pkg.id, pkg.entry));
      // Register based on type
      if (pkg.type === 'input' && module.default) {
        pipeline.addInput(module.default);
      } else if (pkg.type === 'output' && module.default) {
        pipeline.addOutput(module.default);
      } else if (pkg.type === 'tool' && module.default) {
        pipeline.addTool(module.default);
      }
    }
  }
}

/** Default install directory: ~/.config/agentsy/guardrails/ */
export const DEFAULT_GUARDRAIL_DIR = join(homedir(), '.config', 'agentsy', 'guardrails');
```

**hub:// URI format:**

```text
hub://guardrails/prompt_injection
hub://guardrails/pii_scrubber@v1.2.0
hub://guardrails/toxicity
hub://guardrails/secret_detection
```

Resolution order:

1. Built-in: `hub://guardrails/prompt_injection` → builtin scanner
2. Installed: `~/.config/agentsy/guardrails/guardrails/prompt_injection/`
3. Registry: `$GUARDRAIL_HUB_URL/packages/guardrails/prompt_injection` (download on demand)

### 2.7 PolicyEngine — YAML Policy-as-Code

**Pattern:** Microsoft Agent Governance Toolkit — YAML policy documents with conditions on tool annotations + identity.

```typescript
// packages/guardrails/src/policy/types.ts

export type PolicyAction = 'allow' | 'deny' | 'require_approval' | 'escalate';

export interface PolicyCondition {
  /** Tool identity or annotation expression. */
  field: string;              // e.g. "tool.name", "tool.annotations.destructiveHint"
  operator: '==' | '!=' | 'in' | 'not_in' | 'matches';
  value: unknown;
}

export interface PolicyRule {
  name: string;
  description?: string;
  /** All conditions must match (AND). */
  conditions: PolicyCondition[];
  action: PolicyAction;
  /** Optional reason code for audit. */
  reasonCode?: string;
}

export interface PolicyDocument {
  version: string;
  rules: PolicyRule[];
  /** Default action when no rule matches. */
  defaultAction: PolicyAction;
}
```

```typescript
// packages/guardrails/src/policy/policy-engine.ts

import type { PolicyDocument, PolicyRule, PolicyCondition, PolicyAction } from './types.js';

/**
 * Evaluates YAML policy rules against tool calls and annotations.
 * Conditions use dot-notation field access on the tool + args context.
 */
export class PolicyEngine {
  private document: PolicyDocument;

  constructor(document: PolicyDocument) {
    this.document = document;
  }

  /** Evaluate all rules against a tool call context. First match wins. */
  evaluate(tool: { name: string; annotations: Record<string, unknown> }, args: unknown): { action: PolicyAction; rule?: PolicyRule } {
    for (const rule of this.document.rules) {
      if (this.matchAll(rule.conditions, tool, args)) {
        return { action: rule.action, rule };
      }
    }
    return { action: this.document.defaultAction };
  }

  private matchAll(conditions: PolicyCondition[], tool: { name: string; annotations: Record<string, unknown> }, args: unknown): boolean {
    return conditions.every(c => this.matchCondition(c, tool, args));
  }

  private matchCondition(condition: PolicyCondition, tool: { name: string; annotations: Record<string, unknown> }, args: unknown): boolean {
    const value = this.resolveField(condition.field, tool, args);
    switch (condition.operator) {
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'matches': return typeof value === 'string' && typeof condition.value === 'string' && new RegExp(condition.value).test(value);
      default: return false;
    }
  }

  private resolveField(field: string, tool: { name: string; annotations: Record<string, unknown> }, args: unknown): unknown {
    if (field === 'tool.name') return tool.name;
    if (field.startsWith('tool.annotations.')) {
      return tool.annotations[field.slice('tool.annotations.'.length)];
    }
    if (field.startsWith('args.')) {
      if (args && typeof args === 'object') return (args as Record<string, unknown>)[field.slice('args.'.length)];
    }
    if (field === 'tool') return tool;
    return undefined;
  }
}
```

```typescript
// packages/guardrails/src/policy/policy-loader.ts

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { PolicyDocument } from './types.js';

/** Search order: ./.agentsy/policy.yaml → ~/.config/agentsy/policy.yaml */
export async function loadPolicy(path?: string): Promise<PolicyDocument | null> {
  const searchPaths = path
    ? [path]
    : ['./.agentsy/policy.yaml', './policy.yaml', join(homedir(), '.config', 'agentsy', 'policy.yaml')];

  for (const p of searchPaths) {
    try {
      const content = await readFile(p, 'utf-8');
      const doc = parseYaml(content) as PolicyDocument;
      validatePolicyDocument(doc);
      return doc;
    } catch {
      continue;
    }
  }
  return null;
}

function validatePolicyDocument(doc: unknown): asserts doc is PolicyDocument {
  if (!doc || typeof doc !== 'object') throw new Error('Policy document must be an object');
  // ... schema validation
}
```

**Example policy document (`.agentsy/policy.yaml`):**

```yaml
version: "1.0"
rules:
  - name: "block-destructive-root-shell"
    description: "Block shell commands with destructive intent at filesystem root"
    conditions:
      - field: "tool.annotations.destructiveHint"
        operator: "=="
        value: true
      - field: "tool.name"
        operator: "matches"
        value: "shell_exec"
    action: require_approval
    reasonCode: "destructive-shell"

  - name: "deny-open-world-writes"
    description: "Deny tools that write to open-world (network, external APIs)"
    conditions:
      - field: "tool.annotations.openWorldHint"
        operator: "=="
        value: true
      - field: "tool.annotations.destructiveHint"
        operator: "=="
        value: true
    action: deny
    reasonCode: "open-world-write"

  - name: "allow-readonly-tools"
    description: "Allow read-only tools without approval"
    conditions:
      - field: "tool.annotations.readOnlyHint"
        operator: "=="
        value: true
    action: allow
    reasonCode: "readonly-allowed"

defaultAction: require_approval
```

### 2.8 Pipeline Integration with PolicyEngine

```typescript
// Integration in ToolGuardrail pipeline preCheck

export function createPolicyGuardrail(policyEngine: PolicyEngine): ToolGuardrail {
  return createToolGuardrail(
    {
      name: 'policy-engine',
      description: 'YAML policy-as-code evaluator',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-04', 'ASI-05'],
      priority: 5 // Run before all other tool guardrails
    },
    {
      preCheck: (tool, args) => {
        const { action, rule } = policyEngine.evaluate(tool, args);
        switch (action) {
          case 'deny':
            return { block: true, reason: rule?.reasonCode ?? 'policy-deny', code: 'policy-deny' };
          case 'require_approval':
            // Signal to approval hook — this happens via hook, not return code
            // The policy guardrail returns pass but sets meta for approval hook
            return { pass: true };
          case 'escalate':
            return { escalate: true, reason: rule?.reasonCode ?? 'policy-escalate', code: 'policy-escalate', severity: 'high' };
          default:
            return { pass: true };
        }
      }
    }
  );
}
```

---

## Batch 3 — Built-in Scanners (~3h)

**Location:** `packages/guardrails/src/`

### 3.1 Prompt Injection Scanner

```typescript
// packages/guardrails/src/prompt-injection.ts

export function createPromptInjectionGuardrail(): InputGuardrail {
  return createInputGuardrail(
    {
      name: 'prompt-injection',
      description: 'DRIFT-style heuristic injection detector',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-01'],
      priority: 1  // Fastest tier — heuristic/rule-based
    },
    (input, ctx) => {
      const score = detectInjectionRisk(input);
      if (score > 0.7) {
        return { block: true, reason: 'Probable injection attempt', code: 'prompt-injection' };
      }
      return { pass: true };
    }
  );
}
```

`detectInjectionRisk` implements a lightweight heuristic classifier:

- Presence of known injection patterns (role-playing, DAN, jailbreak templates)
- Base64-encoded or obfuscated instructions
- Tear-down instruction chains ("ignore previous instructions")
- Ratio of directive tokens to conversational tokens
- Returns 0.0–1.0 score

### 3.2 PII Scrubber

```typescript
// packages/guardrails/src/pii-scrubber.ts

export function createPiiInputGuardrail(): InputGuardrail {
  return createInputGuardrail(
    {
      name: 'pii-detection',
      description: 'Detect and optionally redact PII in input',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-06'],
      priority: 10
    },
    (input, ctx) => {
      const detections = detectPii(input);
      if (detections.length === 0) return { pass: true };

      // If PII detected, sanitize (replace with placeholders) and warn
      const sanitized = redactPii(input, detections);
      return {
        transform: true,
        sanitized,
        reason: `Redacted PII: ${detections.map(d => d.type).join(', ')}`
      };
    }
  );
}

export function createPiiOutputGuardrail(): OutputGuardrail {
  return createOutputGuardrail(
    {
      name: 'pii-detection',
      description: 'Redact PII in model output before user sees it',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-06', 'ASI-07'],
      priority: 10
    },
    (output, ctx) => {
      const detections = detectPii(output);
      if (detections.length === 0) return { pass: true };

      const sanitized = redactPii(output, detections);
      return { transform: true, sanitized, reason: `Redacted ${detections.length} PII items` };
    }
  );
}
```

Patterns: email, phone, SSN, credit card, IP address, API key patterns (sk-, ghp_, AKIA, etc.).

### 3.3 Secret Detector

```typescript
// packages/guardrails/src/secret-detector.ts

export function createSecretDetectionGuardrail(): OutputGuardrail {
  return createOutputGuardrail(
    {
      name: 'secret-detection',
      description: 'Detect and redact secrets in tool results before model context injection',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-06'],
      priority: 15
    },
    (output, ctx) => {
      const secrets = detectSecrets(output);
      if (secrets.length === 0) return { pass: true };

      const redacted = redactSecrets(output);
      return {
        transform: true,
        sanitized: redacted,
        reason: `Redacted ${secrets.length} potential secrets`
      };
    }
  );
}
```

### 3.4 Path Sanitization

```typescript
// packages/guardrails/src/tool-paths.ts

export function createPathSanitizationGuardrail(): ToolGuardrail {
  return createToolGuardrail(
    {
      name: 'path-sanitization',
      description: 'Block filesystem operations outside allowed roots',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-05', 'ASI-04'],
      priority: 5
    },
    {
      preCheck: (tool, args) => {
        if (tool.name.startsWith('fs_') && isAccessiblePath(args)) {
          const path = (args as Record<string, unknown>)?.path ?? (args as Record<string, unknown>)?.cwd;
          if (typeof path === 'string' && !isAllowedPath(path)) {
            return { block: true, reason: 'Path not in allowed roots', code: 'path-denied' };
          }
        }
        return { pass: true };
      }
    }
  );
}

function isAllowedPath(path: string): boolean {
  // Check path is within project root, not outside, no path traversal
  // Also check against allow/block list in config
  return true; // stub
}
```

### 3.5 Command Validation

```typescript
// packages/guardrails/src/command-validation.ts

export function createCommandValidationGuardrail(): ToolGuardrail {
  return createToolGuardrail(
    {
      name: 'command-validation',
      description: 'Validate shell commands against allowlist',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-04'],
      priority: 5
    },
    {
      preCheck: (tool, args) => {
        if (tool.name === 'shell_exec') {
          const command = (args as Record<string, unknown>)?.command;
          if (typeof command === 'string' && !isAllowedCommand(command)) {
            return { block: true, reason: 'Command not allowed', code: 'command-denied' };
          }
        }
        return { pass: true };
      }
    }
  );
}
```

### 3.6 Toxicity / Output Scanner

```typescript
// packages/guardrails/src/toxicity.ts

export function createToxicityGuardrail(): OutputGuardrail {
  return createOutputGuardrail(
    {
      name: 'toxicity-check',
      description: 'Score output for harmful content using heuristic classifiers',
      version: '1.0.0',
      source: 'builtin',
      owaspCategories: ['ASI-07'],
      priority: 20
    },
    (output, ctx) => {
      const score = toxicityScore(output);
      if (score > 0.8) {
        return { block: true, reason: 'Toxic content detected', code: 'toxicity' };
      }
      return { pass: true };
    }
  );
}
```

### 3.7 Rate Limiter

```typescript
// packages/guardrails/src/rate-limiter.ts

import type { InputGuardrail, GuardrailResult, GuardrailContext } from './types.js';

export class TokenBucketRateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private capacity: number,
    private refillRate: number,  // tokens per second
    private refillInterval: number = 1000
  ) {}

  createGuardrail(): InputGuardrail {
    return {
      metadata: {
        name: 'rate-limiter',
        description: 'Token bucket rate limiter per-user/session',
        version: '1.0.0',
        source: 'builtin',
        owaspCategories: ['ASI-10'],
        priority: 3
      },
      check: (input: string, ctx: GuardrailContext): GuardrailResult => {
        const key = ctx.meta?.userId as string ?? ctx.sessionId;
        if (!this.consume(key, input.length)) {
          return { block: true, reason: 'Rate limit exceeded', code: 'rate-limited' };
        }
        return { pass: true };
      }
    };
  }

  private consume(key: string, tokens: number): boolean {
    // Token bucket implementation
    return true; // stub
  }
}
```

---

## Batch 4 — Approval Engine + Hook Integration (~2h)

**Location:** `packages/runtime/src/approval/` and `packages/runtime/src/guardrails/builtin/`

### 4.1 ApprovalManager

```typescript
// packages/runtime/src/approval/approval-manager.ts

export interface PendingApproval {
  id: string;
  toolCallId: string;
  toolName: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
}

export class ApprovalManager {
  private pending = new Map<string, PendingApproval>();
  private listeners = new Map<string, (id: string, approved: boolean) => void>();

  async request(approval: Omit<PendingApproval, 'id' | 'createdAt' | 'expiresAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const pending: PendingApproval = {
      id,
      ...approval,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30000) // 30s timeout
    };
    this.pending.set(id, pending);
    return id;
  }

  async waitForApproval(approvalId: string, timeoutMs = 30000): Promise<boolean> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        this.listeners.delete(approvalId);
        resolve(false); // timeout = rejected
      }, timeoutMs);

      this.listeners.set(approvalId, (id, approved) => {
        clearTimeout(timeout);
        this.listeners.delete(id);
        resolve(approved);
      });
    });
  }

  approve(approvalId: string): void {
    this.pending.delete(approvalId);
    const listener = this.listeners.get(approvalId);
    if (listener) listener(approvalId, true);
  }

  reject(approvalId: string): void {
    this.pending.delete(approvalId);
    const listener = this.listeners.get(approvalId);
    if (listener) listener(approvalId, false);
  }

  listPending(): PendingApproval[] {
    return [...this.pending.values()];
  }
}
```

### 4.2 Runtime Guardrail Hooks

```typescript
// packages/runtime/src/guardrails/builtin/input-hook.ts

import type { GuardrailPipeline } from '@agentsy/guardrails/pipeline';

export function createInputGuardrailHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:input',
    event: 'pre-turn' as const,
    priority: 50,
    handler: async (ctx: any) => {
      const result = await pipeline.checkInput(ctx.userMessage, {
        sessionId: ctx.sessionId,
        content: ctx.userMessage,
        phase: 'input',
        meta: {}
      });

      if (result.block) {
        ctx.tracer.warn('input_blocked', { reason: result.reason });
        return { ...ctx, blocked: true, reason: result.reason };
      }

      if (result.transform) {
        ctx.userMessage = result.sanitized;
      }

      return ctx;
    }
  };
}
```

```typescript
// packages/runtime/src/guardrails/builtin/tool-guardrail-hook.ts

import type { GuardrailPipeline } from '@agentsy/guardrails/pipeline';

export function createToolGuardrailHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:tool',
    event: 'pre-tool-call' as const,
    priority: 75,
    handler: async (ctx: any) => {
      const result = await pipeline.checkToolPreExecution(
        { name: ctx.toolCall.name, annotations: ctx.toolCall.annotations },
        ctx.toolCall.args
      );

      if (result.block) {
        ctx.tracer.warn('tool_blocked', { tool: ctx.toolCall.name, reason: result.reason });
        return { ...ctx, blocked: true };
      }

      return ctx;
    }
  };
}
```

```typescript
// packages/runtime/src/guardrails/builtin/tool-result-hook.ts

import type { GuardrailPipeline } from '@agentsy/guardrails/pipeline';

export function createToolResultHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:tool-result',
    event: 'post-tool-call' as const,
    priority: 100,
    handler: async (ctx: any) => {
      const result = await pipeline.checkToolPostExecution(
        { name: ctx.toolCall.name, annotations: ctx.toolCall.annotations },
        ctx.toolResult
      );

      if (result.block) {
        ctx.tracer.warn('tool_result_blocked', { tool: ctx.toolCall.name, reason: result.reason });
        ctx.toolResult = { blocked: true, reason: result.reason };
      }

      if (result.transform) {
        ctx.toolResult = result.sanitized;
      }

      return ctx;
    }
  };
}
```

```typescript
// packages/runtime/src/guardrails/builtin/output-hook.ts

import type { GuardrailPipeline } from '@agentsy/guardrails/pipeline';

export function createOutputGuardrailHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:output',
    event: 'pre-response' as const,
    priority: 50,
    handler: async (ctx: any) => {
      const result = await pipeline.checkOutput(ctx.response, {
        sessionId: ctx.sessionId,
        content: ctx.response,
        phase: 'output',
        meta: {}
      });

      if (result.block) {
        ctx.tracer.warn('output_blocked', { reason: result.reason });
        return { ...ctx, blocked: true, reason: result.reason };
      }

      if (result.transform) {
        ctx.response = result.sanitized;
      }

      return ctx;
    }
  };
}
```

### 4.3 Approval Hook

```typescript
// packages/runtime/src/approval/approval-hook.ts

export function createApprovalHook(approvalManager: ApprovalManager) {
  return {
    name: 'runtime:approval',
    event: 'pre-tool-call' as const,
    priority: 100, // After guardrails (guardrails at 75)
    enabled: true,
    handler: async (ctx: any) => {
      // If guardrails already blocked, skip approval
      if (ctx.blocked) return ctx;

      if (ctx.toolCall.annotations.destructiveHint) {
        const approvalId = await approvalManager.request({
          toolCallId: ctx.toolCall.id,
          toolName: ctx.toolCall.name,
          reason: `${ctx.toolCall.name} is destructive and requires approval`
        });

        const approved = await approvalManager.waitForApproval(approvalId);

        if (!approved) {
          ctx.tracer.info('tool_blocked', { tool: ctx.toolCall.name, reason: 'User rejected' });
          return { ...ctx, blocked: true };
        }
      }

      return ctx;
    }
  };
}
```

### 4.4 Hook Wiring

```text
Pre-turn (priority 50):    guardrails:input       → check + sanitize input
Pre-tool-call (priority 75): guardrails:tool       → check tool + args (policy + path + command)
Pre-tool-call (priority 100): runtime:approval      → ask user for destructive ops
Post-tool-call (priority 75): guardrails:tool-result → redact secrets from result
Pre-response (priority 50): guardrails:output      → redact PII, check toxicity
```

---

## Batch 5 — CLI Guardrails Commands (~2h)

**Location:** `packages/cli/src/`

### 5.1 `agentsy guardrails list`

```bash
agentsy guardrails list
# ┌──────────────────────┬────────┬──────────┬────────────────╮
# │ Name                 │ Type   │ Source   │ OWASP          │
# ├──────────────────────┼────────┼──────────┼────────────────┤
# │ prompt-injection     │ input  │ builtin  │ ASI-01         │
# │ pii-detection        │ input  │ builtin  │ ASI-06         │
# │ rate-limiter         │ input  │ builtin  │ ASI-10         │
# │ path-sanitization    │ tool   │ builtin  │ ASI-05, ASI-04 │
# │ command-validation   │ tool   │ builtin  │ ASI-04         │
# │ pii-detection        │ output │ builtin  │ ASI-06, ASI-07 │
# │ secret-detection     │ output │ builtin  │ ASI-06         │
# │ toxicity-check       │ output │ builtin  │ ASI-07         │
# └──────────────────────┴────────┴──────────┴────────────────╯
```

### 5.2 `agentsy guardrails install`

```bash
agentsy guardrails install hub://guardrails/custom_policy
# ✓ Installed guardrails/custom_policy@v1.0.0 as tool guardrail
# OWASP categories: ASI-04, ASI-05

agentsy guardrails install hub://guardrails/toxicity
# ✓ Installed guardrails/toxicity@v2.1.0 as output guardrail
```

### 5.3 `agentsy guardrails uninstall`

```bash
agentsy guardrails uninstall guardrails/custom_policy
# ✓ Uninstalled guardrails/custom_policy
```

### 5.4 `agentsy guardrails policy`

```bash
agentsy guardrails policy
# Loaded ./.agentsy/policy.yaml (v1.0)
# ┌──────────────────────────────┬──────────┬──────────────┐
# │ Rule                         │ Action   │ Reason Code  │
# ├──────────────────────────────┼──────────┼──────────────┤
# │ block-destructive-root-shell │ approve  │ destructive- │
# │                              │          │ shell        │
# │ deny-open-world-writes       │ deny     │ open-world-  │
# │                              │          │ write        │
# │ allow-readonly-tools         │ allow    │ readonly-    │
# │                              │          │ allowed      │
# └──────────────────────────────┴──────────┴──────────────┘
# Default action: require_approval
```

### 5.5 CLI Command Tree

```typescript
// packages/cli/src/commands/guardrails.ts
export const guardrailsCommand = {
  command: 'guardrails',
  description: 'Manage guardrail policies and hub packages',
  subcommands: {
    list: {
      description: 'List all registered guardrails',
      handler: () => { /* print table from pipeline.list() */ }
    },
    install: {
      description: 'Install a guardrail from hub:// URI',
      args: [{ name: 'uri', required: true }],
      handler: (uri: string) => { /* hub.install(uri) */ }
    },
    uninstall: {
      description: 'Remove an installed guardrail',
      args: [{ name: 'id', required: true }],
      handler: (id: string) => { /* hub.uninstall(id) */ }
    },
    policy: {
      description: 'Show loaded policy document',
      handler: () => { /* print policy rules table */ }
    }
  }
};
```

---

## Batch 6 — Workspace Panes + E2E (~3h)

### 6.1 Document Viewer

```typescript
// packages/renderers/src/ink/components/document-viewer/index.tsx
export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  path,
  content,
  lineNumbers = true,
  highlights?: LineRange[]
}) => {
  const lines = content.split('\n');
  const scrollPos = React.useState(0);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" title={path}>
        {lines.map((line, i) => (
          <Box key={i}>
            {lineNumbers && <Text width={4}>{String(i + 1).padStart(4)}</Text>}
            <Text color={highlights?.some(r => i >= r.start && i <= r.end) ? 'yellow' : undefined}>
              {line}
            </Text>
          </Box>
        ))}
      </Box>
      <Text color="dim">j/k scroll | q close</Text>
    </Box>
  );
};
```

### 6.2 Diff Viewer

```typescript
// packages/renderers/src/ink/components/diff-viewer/index.tsx
export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  language
}) => {
  const diff = computeDiff(original, modified);

  return (
    <Box flexDirection="column">
      {diff.hunks.map(hunk => (
        <Box key={hunk.index}>
          <Text color="dim">@@ {hunk.location} @@</Text>
          {hunk.lines.map(line => (
            <Box key={line.index}>
              <Text color={line.type === 'add' ? 'green' : line.type === 'remove' ? 'red' : 'white'}>
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                {line.content}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};
```

### 6.3 E2E Tests

```typescript
test('approve destructive tool', async () => {
  // 1. Agent requests tool execution
  // 2. CLI displays approval prompt
  // 3. User presses A
  // 4. Tool executes + result displayed
});

test('reject tool', async () => {
  // 1. Agent requests tool execution
  // 2. CLI displays approval prompt
  // 3. User presses R
  // 4. Tool not executed; agent informed
});

test('guardrail blocks injection', async () => {
  // 1. User sends prompt-injection input
  // 2. Input guardrail fires, blocks
  // 3. User sees block reason
});

test('guardrail redacts PII from output', async () => {
  // 1. Model returns content containing email
  // 2. Output guardrail transforms, redacts
  // 3. User sees redacted content
});

test('policy document blocks open-world write', async () => {
  // 1. Load .agentsy/policy.yaml
  // 2. Agent calls openWorldHint + destructiveHint tool
  // 3. Policy engine denies
});

test('install hub guardrail', async () => {
  // 1. agentsy guardrails install hub://guardrails/custom
  // 2. Guardrail appears in list
  // 3. Guardrail runs on next event
});
```

---

## Implementation Order

Execute in git flow branch `feature/phase-5-guardrails` in this order:

| Step | Batch | Output |
|------|-------|--------|
| 1 | Batch 1 (MCP + Tools) | `@agentsy/mcp` types updated, `@agentsy/tools` registry + baseline tools |
| 2 | Batch 2 (Guardrails core) | types, pipeline, hub, policy engine |
| 3 | Batch 3 (Built-in scanners) | all 7 built-in scanners |
| 4 | Batch 4 (Approval + Hooks) | ApprovalManager, hook factories, wiring |
| 5 | Batch 5 (CLI) | guardrails subcommands |
| 6 | Batch 6 (Panes + E2E) | DocumentViewer, DiffViewer, E2E tests |

Run `pnpm check-types` + `pnpm test` after each step.

---

## Quality Gates

- ✅ All tools have complete annotations
- ✅ GuardrailResult supports pass/block/transform/escalate outcomes
- ✅ GuardrailPipeline sorts by priority (fast scanners first)
- ✅ GuardrailHub resolves `hub://` URIs to installed packages
- ✅ PolicyEngine evaluates YAML conditions on tool annotations
- ✅ Built-in scanners: prompt-injection, PII, secret, path, command, toxicity, rate-limiter
- ✅ Built-in scanners carry OWASP category metadata
- ✅ Approval path blocks without user acceptance
- ✅ CLI `guardrails list | install | uninstall | policy` commands
- ✅ Hook/Prompt Axiom enforced: all safety in hooks, none in prompts
- ✅ Tool execution deterministic + auditable
- ✅ `pnpm test` all tests pass
- ✅ E2E approval + guardrail flows working

---

## Success Criteria

✅ Tools executable with explicit user approval  
✅ Deny-by-default for destructive operations  
✅ Guardrail pipeline detecting/blocking/redacting violations  
✅ Hub registry for extensible guardrail packages (`hub://` URIs)  
✅ Policy-as-code via YAML (`./agentsy/policy.yaml`)  
✅ Built-in scanners for injection, PII, secrets, paths, commands, toxicity, rate limits  
✅ OWASP ASI Top 10 classification on all scanners  
✅ CLI commands for guardrail management  
✅ Secret detection + PII redaction working  
✅ Tool execution auditable

---

**Next phase:** `09-PHASE-6-SESSION-DURABILITY.md`
