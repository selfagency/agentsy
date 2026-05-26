# Phase 5 — Tools, Approvals & Guardian Enforcement

**Effort:** ~16 hours  
**Milestone:** Safe tool execution with deny-by-default approvals  
**Packages:** `@agentsy/tools`, `@agentsy/mcp`, `@agentsy/runtime`, `@agentsy/guardrails`, `@agentsy/renderers`, `@agentsy/cli`  
**Gate:** Tool approval path working; guardrail pipeline integrated  
**Next:** Phase 6  

---

## Overview

Enable safe tool execution with explicit user approvals. Implement guardrails (input/output validation, secret detection, PII scrubbing). Tool execution happens only after approval-gating + policy validation.

---

## 1. Tools Registry (MCP-Compliant)

### TASK-019: Baseline Tool Registry

**Owner:** Tools team  
**Effort:** ~2 hours  
**Location:** `packages/tools/src/`

#### Required Annotations Pattern

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
      readOnlyHint: false,           // REQUIRED
      destructiveHint: true,         // REQUIRED
      idempotentHint: false,         // REQUIRED
      openWorldHint: false,          // REQUIRED
      requiresCredential: undefined,
      progressNotifications: false
    },
    handler: async (input) => { /* ... */ }
  },
  // ...
];
```

Registration without complete annotations throws `ToolAnnotationError` at registration time.

#### Baseline Tools

**1. REPL Execution**

```typescript
{
  name: 'repl_execute',
  description: 'Execute code in session kernel',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  },
  handler: async (input: { code: string }, ctx: ToolContext) => {
    const kernel = ctx.session.getOrCreateKernel();
    const result = await kernel.execute(input.code);
    return { output: result.stdout, error: result.stderr };
  }
}
```

Kernel lifecycle: one per session, state persists across turns, `kernel.reset()` available as tool.

**2. File Operations (Maki Tree-Sitter Aware)**

```typescript
{
  name: 'fs_read',
  description: 'Read file (structural parsing if code)',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  handler: async (input: { path: string }, ctx: ToolContext) => {
    // 59 tokens structural analysis via Maki
    // vs 224 tokens raw read
    const content = await fs.readFile(path, 'utf-8');
    if (isCode(path)) {
      return { structured: parseStructure(content) };
    }
    return { content };
  }
}

{
  name: 'fs_write',
  description: 'Write file with optional structural patch',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  },
  handler: async (input: { path: string; content: string }, ctx: ToolContext) => {
    // Backup existing
    const backup = await fs.readFile(path, 'utf-8').catch(() => undefined);
    if (backup) ctx.session.checkpoint({ type: 'fs_backup', path, backup });

    await fs.writeFile(path, input.content);
    return { success: true };
  }
}

{
  name: 'fs_patch',
  description: 'Patch file with structural awareness',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  },
  handler: async (input: { path: string; hunks: Hunk[] }, ctx: ToolContext) => {
    // Apply unified diff hunks
    const result = await applyPatch(path, input.hunks);
    return result;
  }
}
```

**3. Shell Wrapper**

```typescript
{
  name: 'shell_exec',
  description: 'Execute shell command (restricted)',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
    requiresCredential: undefined
  },
  handler: async (input: { command: string }, ctx: ToolContext) => {
    // Validate command against allowlist
    const allowList = ctx.config.shellAllowList || DEFAULTS;
    if (!isAllowed(input.command, allowList)) {
      throw new ForbiddenCommandError(input.command);
    }

    const { stdout, stderr, exitCode } = await execSync(input.command);
    return { stdout, stderr, exitCode };
  }
}
```

**4. HTTP Fetch**

```typescript
{
  name: 'http_fetch',
  description: 'Fetch URL',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  handler: async (input: { url: string; method?: string }, ctx: ToolContext) => {
    // URL validation + content-type filtering
    if (!isValidUrl(input.url)) throw new InvalidUrlError(input.url);

    const response = await fetch(input.url, {
      method: input.method || 'GET',
      timeout: 10000
    });

    return {
      status: response.status,
      content: await response.text(),
      contentType: response.headers['content-type']
    };
  }
}
```

**5. MCP Bridge**

```typescript
{
  name: 'mcp_call',
  description: 'Call MCP server tool',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    requiresCredential: 'custom'
  },
  handler: async (input: { server: string; tool: string; args: any }, ctx: ToolContext) => {
    const client = ctx.mcp.getClient(input.server);
    return client.callTool(input.tool, input.args);
  }
}
```

#### Tool Registry Interface

```typescript
export class ToolRegistry {
  register(tool: ToolDefinition) {
    // Validate annotations present
    if (!tool.annotations) {
      throw new ToolAnnotationError('Tool requires complete annotations');
    }

    this.tools.set(tool.name, tool);
  }

  async list(cursor?: string, limit?: number): Promise<ToolListPage> {
    return paginate(this.tools, cursor, limit);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(
    name: string,
    input: unknown,
    ctx: ToolContext
  ): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) throw new ToolNotFoundError(name);

    // Run pre-hooks (guardrails)
    await ctx.hooks.fire('pre-tool-call', { tool, input });

    // Execute
    const result = await tool.handler(input, ctx);

    // Run post-hooks (secret detection, redaction)
    await ctx.hooks.fire('post-tool-call', { tool, result });

    return result;
  }
}
```

---

## 2. MCP Spec Compliance

### REVISED P2-2: Audit + Modernization

**Owner:** MCP team  
**Effort:** ~1 hour

**Audit against MCP spec 2025-06-18:**

- ✅ `Tool` type matches spec
- ✅ `ResourceTemplate` patterns
- ✅ `TextContent` | `ImageContent` (PNG/JPEG/GIF/WebP)
- ✅ No JSON-RPC batching (removed in 2025-06)
- ✅ `authorizationServerUrl` capability
- ✅ `elicitation` capability for interactive tools

**Updates:**

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

---

## 3. Approval Engine

### TASK-020/021: Deny-by-Default Gate

**Owner:** Runtime team  
**Effort:** ~1.5 hours  
**Location:** `packages/runtime/src/approval/`

```typescript
export interface PendingApproval {
  id: string;
  toolCallId: string;
  toolName: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
}

export class ApprovalManager {
  async request(approval: Omit<PendingApproval, 'id' | 'createdAt' | 'expiresAt'>): Promise<string> {
    const id = uuidv4();
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
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);

      this.on('approval-resolved', (id, approved) => {
        if (id === approvalId) {
          clearTimeout(timeout);
          resolve(approved);
        }
      });
    });
  }

  approve(approvalId: string) {
    this.pending.delete(approvalId);
    this.emit('approval-resolved', approvalId, true);
  }

  reject(approvalId: string) {
    this.pending.delete(approvalId);
    this.emit('approval-resolved', approvalId, false);
  }
}
```

**Integration in hook:**

```typescript
export function createApprovalHook(approvalManager: ApprovalManager) {
  return {
    name: 'runtime:approval',
    event: 'pre-tool-call',
    priority: 100,
    enabled: true,
    handler: async (ctx) => {
      if (ctx.toolCall.annotations.destructiveHint) {
        const approvalId = await approvalManager.request({
          toolCallId: ctx.toolCall.id,
          toolName: ctx.toolCall.name,
          reason: `${ctx.toolCall.name} is destructive and requires approval`
        });

        const approved = await approvalManager.waitForApproval(approvalId);

        if (!approved) {
          ctx.tracer.info('tool_blocked', {
            tool: ctx.toolCall.name,
            reason: 'User rejected'
          });

          return { ...ctx, blocked: true };
        }
      }

      return ctx;
    }
  };
}
```

---

## 4. Guardrails Policy Engine

### REVISED P0-3: Complete Implementation

**Owner:** Guardrails team  
**Effort:** ~2 hours  
**Location:** `packages/guardrails/src/`

#### 1. Input Guardrail

```typescript
export interface InputGuardrail {
  name: string;
  check(input: string, ctx: GuardrailContext): GuardrailResult;
}

export function createInputGuardrail(
  name: string,
  check: (input: string) => GuardrailResult
): InputGuardrail {
  return { name, check };
}

// Built-in
export const inputGuardrails = {
  promptInjection: createInputGuardrail('prompt-injection', (input) => {
    // DRIFT-style heuristic detector
    const score = detectInjectionRisk(input);
    if (score > 0.7) {
      return { blocked: true, reason: 'Probable injection attempt' };
    }
    return { blocked: false };
  }),

  piiCheck: createInputGuardrail('pii-check', (input) => {
    const pii = detectPii(input);
    if (pii.length > 0) {
      return {
        blocked: false,
        warning: `Detected: ${pii.join(', ')}`,
        detections: pii
      };
    }
    return { blocked: false };
  })
};
```

#### 2. Output Guardrail

```typescript
export interface OutputGuardrail {
  name: string;
  check(output: string, ctx: GuardrailContext): GuardrailResult;
}

export function createOutputGuardrail(
  name: string,
  check: (output: string) => GuardrailResult
): OutputGuardrail {
  return { name, check };
}

// Built-in
export const outputGuardrails = {
  secretDetection: createOutputGuardrail('secret-detection', (output) => {
    const secrets = detectSecrets(output);
    if (secrets.length > 0) {
      return {
        blocked: false,
        warning: `Found ${secrets.length} potential secrets`,
        redacted: redactSecrets(output).redacted
      };
    }
    return { blocked: false };
  }),

  toxicity: createOutputGuardrail('toxicity-check', (output) => {
    const score = toxicityScore(output);
    if (score > 0.8) {
      return { blocked: true, reason: 'Toxic content detected' };
    }
    return { blocked: false };
  })
};
```

#### 3. Tool Guardrail

```typescript
export interface ToolGuardrail {
  name: string;
  preCheck?(tool: ToolDefinition, args: unknown): GuardrailResult;
  postCheck?(tool: ToolDefinition, result: unknown): GuardrailResult;
}

export function createToolGuardrail(
  name: string,
  preCheck?: (tool, args) => GuardrailResult,
  postCheck?: (tool, result) => GuardrailResult
): ToolGuardrail {
  return { name, preCheck, postCheck };
}

// Built-in
export const toolGuardrails = {
  pathSanitization: createToolGuardrail(
    'path-sanitization',
    (tool, args) => {
      if (tool.name.startsWith('fs_')) {
        const path = args.path || args.cwd;
        if (!isAllowedPath(path)) {
          return { blocked: true, reason: 'Path not in allowed roots' };
        }
      }
      return { blocked: false };
    }
  ),

  commandValidation: createToolGuardrail(
    'command-validation',
    (tool, args) => {
      if (tool.name === 'shell_exec') {
        if (!isAllowedCommand(args.command)) {
          return { blocked: true, reason: 'Command not allowed' };
        }
      }
      return { blocked: false };
    }
  ),

  credentialValidation: createToolGuardrail(
    'credential-validation',
    (tool) => {
      if (tool.annotations.requiresCredential) {
        // Will be checked in approval hook
      }
      return { blocked: false };
    }
  )
};
```

#### 4. Guardrail Pipeline

```typescript
export class GuardrailPipeline {
  private inputGuardrails: InputGuardrail[] = [];
  private outputGuardrails: OutputGuardrail[] = [];
  private toolGuardrails: ToolGuardrail[] = [];

  async checkInput(input: string, ctx: GuardrailContext): Promise<GuardrailResult> {
    for (const guardrail of this.inputGuardrails) {
      const result = guardrail.check(input, ctx);
      if (result.blocked) return result;
    }
    return { blocked: false };
  }

  async checkToolPreExecution(tool: ToolDefinition, args: unknown): Promise<GuardrailResult> {
    for (const guardrail of this.toolGuardrails) {
      if (guardrail.preCheck) {
        const result = guardrail.preCheck(tool, args);
        if (result.blocked) return result;
      }
    }
    return { blocked: false };
  }

  async checkOutput(output: string, ctx: GuardrailContext): Promise<GuardrailResult> {
    for (const guardrail of this.outputGuardrails) {
      const result = guardrail.check(output, ctx);
      if (result.blocked) return result;
    }
    return { blocked: false };
  }
}
```

#### 5. Built-in Hooks

```typescript
// packages/runtime/src/guardrails/builtin/

export function createInputGuardrailHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:input',
    event: 'pre-turn',
    priority: 50,
    handler: async (ctx) => {
      const result = await pipeline.checkInput(ctx.userMessage, ctx);
      if (result.blocked) {
        ctx.tracer.warn('input_blocked', { reason: result.reason });
        return { ...ctx, blocked: true, reason: result.reason };
      }
      return ctx;
    }
  };
}

export function createToolGuardrailHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:tool',
    event: 'pre-tool-call',
    priority: 75,
    handler: async (ctx) => {
      const result = await pipeline.checkToolPreExecution(ctx.toolCall, ctx.toolCall.args);
      if (result.blocked) {
        ctx.tracer.warn('tool_blocked', { tool: ctx.toolCall.name, reason: result.reason });
        return { ...ctx, blocked: true };
      }
      return ctx;
    }
  };
}

export function createSecretDetectionHook(pipeline: GuardrailPipeline) {
  return {
    name: 'guardrails:secret-detection',
    event: 'post-tool-call',
    priority: 100,
    handler: async (ctx) => {
      const result = await pipeline.checkOutput(ctx.toolResult, ctx);
      if (result.redacted) {
        ctx.toolResult = result.redacted;
      }
      if (result.warning) {
        ctx.tracer.warn('secret_detected', { warning: result.warning });
      }
      return ctx;
    }
  };
}
```

---

## 5. Workspace Panes

### TASK-075/076: Document + Diff Viewers

**Owner:** Renderers team  
**Effort:** ~1.5 hours  
**Location:** `packages/renderers/src/ink/components/`

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
    <Box flexDirection=\"column\">
      <Box borderStyle=\"round\" title={path}>
        {lines.map((line, i) => (
          <Box key={i}>
            {lineNumbers && <Text width={4}>{String(i + 1).padStart(4)}</Text>}
            <Text
              color={highlights?.some(r => i >= r.start && i <= r.end) ? 'yellow' : undefined}
            >
              {line}
            </Text>
          </Box>
        ))}
      </Box>
      <Text color=\"dim\">j/k scroll | q close</Text>
    </Box>
  );
};

// packages/renderers/src/ink/components/diff-viewer/index.tsx
export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  language
}) => {
  const diff = computeDiff(original, modified);

  return (
    <Box flexDirection=\"column\">
      {diff.hunks.map((hunk) => (
        <Box key={hunk.index}>
          <Text color=\"dim\">@@ {hunk.location} @@</Text>
          {hunk.lines.map((line) => (
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

// Slash command integration
// /open-document /path/to/file
// /open-diff /path/to/original /path/to/modified
```

---

## 6. CLI Integration + E2E

### TASK-023/024: Tool Approval E2E Tests

**Owner:** CLI team  
**Effort:** ~1.5 hours

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

test('timeout (30 seconds)', async () => {
  // 1. Agent requests tool execution
  // 2. User doesn't respond
  // 3. Approval times out
  // 4. Tool not executed; error displayed
});

test('abort during execution', async () => {
  // 1. Tool executing
  // 2. User presses Ctrl+C
  // 3. Tool aborted gracefully
  // 4. Session can continue or exit
});
```

---

## Quality Gates

- ✅ All tools have complete annotations
- ✅ Approval path blocking without user acceptance
- ✅ Guardrails pipeline comprehensive
- ✅ Tool execution deterministic + auditable
- ✅ `pnpm test` all tests pass
- ✅ E2E approval flow working

---

## Success Criteria

✅ Tools executable with explicit user approval  
✅ Deny-by-default for destructive operations  
✅ Guardrails detecting/blocking/redacting violations  
✅ Secret detection working  
✅ Tool execution auditable  

---

**Next phase:** `09-PHASE-6-SESSION-DURABILITY.md`
