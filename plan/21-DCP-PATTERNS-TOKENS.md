# DCP Patterns Integration Plan — @agentsy/tokens

**Authority:** `plan/17-GOVERNANCE-QUALITY-GATES.md`  
**Created:** 2026-05-28  
**Status:** Planned

---

## Goal

Adopt three key patterns from the DCP (Dynamic Context Pruning) project into `@agentsy/tokens`:

1. **Model-exposed `compress` tool** — LLM autonomously decides when to compress stale conversation content
2. **Deduplication** — Remove repeated tool calls (same tool + args), keep only most recent output
3. **Protected tools + file patterns** — Certain tool outputs and files are never pruned

**Note:** DCP is AGPL-3.0 licensed — we adopt the *patterns*, not the code. All implementation is original TypeScript.

---

## Current State

### What @agentsy/tokens has

- `compressOutput(input, options)` — programmatic output compression (code fence protection, URL preservation, prose compression)
- `createInMemoryTokenManager()` — budget management, cost tracking, allocation
- `PacingController` — rate limiting, throttling
- `compressConversation()` — conversation-level compression (placeholder-based)

### What DCP adds

| DCP Pattern | Current Equivalent | Gap |
|-------------|-------------------|-----|
| Model-exposed `compress` tool | `compressOutput()` called by runtime | 🔴 Model can't call it autonomously |
| Deduplication | None | 🔴 No dedup at all |
| Protected tools | `preserve` option (code/URLs only) | 🔴 No tool-level protection |
| Protected file patterns | None | 🔴 No file-level protection |
| Context limit nudges | None | 🔴 No nudging system |
| Turn protection | None | 🟡 Nice to have |
| Per-model context limits | Single `maxContextLimit` | 🟡 Nice to have |

---

## Implementation Tasks

### TASK-DCP-001: Compress tool registration

**Effort:** 1.5h  
**Location:** `packages/tokens/src/compress-tool.ts`

Create a tool definition the LLM can call:

```typescript
export interface CompressToolParams {
  mode: 'range' | 'message';
  focus?: string;        // Optional: what content to compress
  range?: { start: number; end: number };  // For range mode
  messageIds?: string[]; // For message mode
}

export function createCompressTool(options: {
  onCompress: (params: CompressToolParams) => Promise<CompressionResult>;
  permission: 'allow' | 'ask' | 'deny';
}): ToolDefinition {
  return {
    name: 'compress',
    description: 'Compress stale conversation content to reduce token usage. Use when conversation grows long or context feels stale.',
    parameters: CompressToolParamsSchema,
    permission: options.permission,
    execute: async (params) => options.onCompress(params)
  };
}
```

**Integration points:**

- Register in `@agentsy/orchestrator` tool registry
- Expose to LLM as a callable tool
- Runtime handles `ask` permission mode (prompt user before compressing)

### TASK-DCP-002: Deduplication engine

**Effort:** 2h  
**Location:** `packages/tokens/src/dedup.ts`

```typescript
export interface ToolCallSignature {
  toolName: string;
  argsHash: string;  // SHA-256 of JSON-serialized args
}

export class DeduplicationEngine {
  private seen = new Map<string, { turn: number; output: unknown }>();

  isDuplicate(call: ToolCallSignature, currentTurn: number): boolean {
    const key = `${call.toolName}:${call.argsHash}`;
    const existing = this.seen.get(key);
    if (!existing) return false;

    // Keep most recent, mark older as duplicate
    if (existing.turn < currentTurn) {
      this.seen.set(key, { turn: currentTurn, output: existing.output });
      return true;
    }
    return false;
  }

  register(call: ToolCallSignature, turn: number, output: unknown): void {
    const key = `${call.toolName}:${call.argsHash}`;
    this.seen.set(key, { turn, output });
  }

  clear(): void {
    this.seen.clear();
  }

  getStats(): { total: number; duplicates: number; unique: number } {
    return {
      total: this.seen.size,
      duplicates: 0,  // Track during processing
      unique: this.seen.size
    };
  }
}
```

**Recalculation:** Dedup is recalculated when `compress` tool runs, so prompt cache is only impacted alongside compression.

**Protected tools:** Certain tools are never deduplicated (configurable).

### TASK-DCP-003: Protected tools configuration

**Effort:** 1h  
**Location:** `packages/tokens/src/protection.ts`

```typescript
export interface ProtectionConfig {
  protectedTools: string[];    // Tool names never to prune/dedup
  protectedFilePatterns: string[];  // Glob patterns for file protection
  protectUserMessages: boolean;     // Preserve user messages during compression
  protectTags: boolean;             // Preserve <protect>...</protect> content
}

export const DEFAULT_PROTECTED_TOOLS = [
  'task', 'skill', 'todowrite', 'todoread', 'compress',
  'write', 'edit'
];

export class ProtectionEngine {
  private config: ProtectionConfig;

  isToolProtected(toolName: string): boolean {
    return this.config.protectedTools.includes(toolName);
  }

  isFileProtected(filePath: string): boolean {
    return this.config.protectedFilePatterns.some(pattern =>
      minimatch(filePath, pattern)
    );
  }

  shouldPreserveMessage(role: string): boolean {
    return this.config.protectUserMessages && role === 'user';
  }
}
```

### TASK-DCP-004: Context limit nudging system

**Effort:** 1.5h  
**Location:** `packages/tokens/src/nudge.ts`

```typescript
export interface NudgeConfig {
  maxContextLimit: number;    // Soft upper threshold (tokens)
  minContextLimit: number;    // Soft lower threshold (tokens)
  nudgeFrequency: number;     // How often nudge fires (1 = every fetch, 5 = every 5th)
  iterationNudgeThreshold: number;  // Messages since last user message before nudging
  nudgeForce: 'strong' | 'soft';    // How aggressively to nudge
}

export class NudgeController {
  private config: NudgeConfig;
  private turnCount = 0;
  private messagesSinceUser = 0;

  shouldNudge(currentTokens: number): boolean {
    if (currentTokens < this.config.minContextLimit) return false;
    if (currentTokens < this.config.maxContextLimit) {
      // Below max, only nudge based on frequency
      return this.turnCount % this.config.nudgeFrequency === 0;
    }

    // Above max, always nudge (with force level)
    return true;
  }

  getNudgeMessage(): string {
    return this.config.nudgeForce === 'strong'
      ? 'Context is near the limit. Use the compress tool to reduce token usage.'
      : 'Consider using the compress tool if context grows large.';
  }

  recordTurn(role: string): void {
    this.turnCount++;
    if (role === 'user') {
      this.messagesSinceUser = 0;
    } else {
      this.messagesSinceUser++;
    }
  }

  reset(): void {
    this.turnCount = 0;
    this.messagesSinceUser = 0;
  }
}
```

### TASK-DCP-005: Per-model context limits

**Effort:** 1h  
**Location:** `packages/tokens/src/model-limits.ts`

```typescript
export interface ModelLimits {
  maxContextLimit?: number;   // Override for specific model
  minContextLimit?: number;   // Override for specific model
}

export class ModelLimitRegistry {
  private limits = new Map<string, ModelLimits>();  // key: "provider/model"

  register(providerId: string, modelId: string, limits: ModelLimits): void {
    this.limits.set(`${providerId}/${modelId}`, limits);
  }

  getLimits(providerId: string, modelId: string): ModelLimits | undefined {
    return this.limits.get(`${providerId}/${modelId}`);
  }

  resolve(providerId: string, modelId: string, globalMax: number, globalMin: number): { max: number; min: number } {
    const modelLimits = this.getLimits(providerId, modelId);
    return {
      max: modelLimits?.maxContextLimit ?? globalMax,
      min: modelLimits?.minContextLimit ?? globalMin
    };
  }
}
```

### TASK-DCP-006: Turn protection

**Effort:** 0.5h  
**Location:** `packages/tokens/src/turn-protection.ts`

```typescript
export interface TurnProtectionConfig {
  enabled: boolean;
  turns: number;  // Keep recent turns from pruning
}

export class TurnProtection {
  private config: TurnProtectionConfig;
  private recentTurns: { toolName: string; turn: number }[] = [];

  isProtected(toolName: string, currentTurn: number): boolean {
    if (!this.config.enabled) return false;

    return this.recentTurns.some(
      t => t.toolName === toolName && (currentTurn - t.turn) <= this.config.turns
    );
  }

  recordTurn(toolName: string, turn: number): void {
    this.recentTurns.push({ toolName, turn });
    // Prune old entries
    const cutoff = turn - this.config.turns - 1;
    this.recentTurns = this.recentTurns.filter(t => t.turn > cutoff);
  }
}
```

### TASK-DCP-007: Integration with existing compression

**Effort:** 1.5h  
**Location:** `packages/tokens/src/compression/`

Update `compressOutput()` and `compressConversation()` to respect:

- Protected tools (never compress their output)
- Protected file patterns (keep file content in compression summaries)
- User message protection
- Tag protection (`<protect>...</protect>`)

### TASK-DCP-008: Tests

**Effort:** 2h

#### compress-tool.test.ts

- Tool registration with correct schema
- `allow` permission → executes without prompt
- `ask` permission → returns approval request
- `deny` permission → tool not registered

#### dedup.test.ts

- Same tool + same args → duplicate detected
- Same tool + different args → not duplicate
- Most recent output preserved
- Protected tools excluded from dedup
- Stats tracking accurate

#### protection.test.ts

- Tool name matching
- File glob pattern matching
- User message protection
- Tag protection

#### nudge.test.ts

- Below minContextLimit → no nudge
- Between min and max → nudge based on frequency
- Above max → always nudge
- Strong vs soft force levels
- Iteration threshold behavior

#### model-limits.test.ts

- Per-model override takes precedence
- Missing override → global defaults
- Register/unregister models

#### turn-protection.test.ts

- Recent turns protected
- Old turns not protected
- Protection window slides correctly

---

## Configuration Schema

```typescript
export interface DcpConfig {
  enabled: boolean;
  compress: {
    mode: 'range' | 'message';
    permission: 'allow' | 'ask' | 'deny';
    maxContextLimit: number;
    minContextLimit: number;
    nudgeFrequency: number;
    iterationNudgeThreshold: number;
    nudgeForce: 'strong' | 'soft';
    protectedTools: string[];
    protectTags: boolean;
    protectUserMessages: boolean;
  };
  strategies: {
    deduplication: {
      enabled: boolean;
      protectedTools: string[];
    };
    purgeErrors: {
      enabled: boolean;
      turns: number;
      protectedTools: string[];
    };
  };
  turnProtection: {
    enabled: boolean;
    turns: number;
  };
  protectedFilePatterns: string[];
  modelLimits: Record<string, { maxContextLimit?: number; minContextLimit?: number }>;
}
```

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| `@agentsy/orchestrator` | Register `compress` tool in tool registry |
| `@agentsy/runtime` | Nudge injection into system message, dedup recalculation on compress |
| `@agentsy/gateway` | Per-model context limits resolved during model selection |
| `@agentsy/cli` | `/compress` slash command, `/context` token breakdown |

---

## Timeline

| Task | Effort | Dependencies |
|------|--------|-------------|
| DCP-001: Compress tool registration | 1.5h | None |
| DCP-002: Deduplication engine | 2h | None |
| DCP-003: Protected tools config | 1h | None |
| DCP-004: Nudge system | 1.5h | DCP-001 |
| DCP-005: Per-model limits | 1h | None |
| DCP-006: Turn protection | 0.5h | None |
| DCP-007: Integration with compression | 1.5h | DCP-002, DCP-003 |
| DCP-008: Tests | 2h | DCP-001 through DCP-007 |
| **Total** | **~11 hours** | |

---

## Success Criteria

- [ ] `compress` tool registered and callable by LLM
- [ ] Deduplication detects and removes repeated tool calls
- [ ] Protected tools never pruned or deduplicated
- [ ] Protected file patterns respected during compression
- [ ] Nudge system fires at correct thresholds
- [ ] Per-model context limits override global defaults
- [ ] Turn protection keeps recent tool outputs intact
- [ ] All tests pass
- [ ] `pnpm check-types` clean
- [ ] `pnpm lint` clean

---

**Next:** Begin TASK-DCP-001 (compress tool registration).
