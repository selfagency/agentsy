# Phase 4 — Orchestration, Hooks, Skills, Instructions, Agents, Secrets, Prompts, Plugins, Budget

**Effort:** ~24 hours  
**Milestone:** Gate before autonomous tool usage; approval path + policy engine complete  
**Packages:** `@agentsy/orchestrator`, `@agentsy/plugins`, `@agentsy/runtime`, `@agentsy/prompts`, `@agentsy/tokens`, `@agentsy/secrets`, `@agentsy/renderers`, `@agentsy/cli`  
**Gate:** All hooks, plan mode, plugin security, agent/skill commands complete  
**Next:** Phase 5  

---

## Overview

Wire full orchestration control plane. Load agent definitions + skills + instructions. Enforce token budget. Bootstrap secrets broker. Establish default-deny hook system.

**Foundation:** Phase 0-2 hook taxonomy verified. This phase adds discovery loaders + composition.

---

## 1. Hook Registry & Agent Session (Orchestrator)

### TASK-HOOK-001..004 (Phase 0): Already Complete ✅

Verified in Phase 0. Phase 4 adds built-in hook implementations.

### TASK-ORCH-013..016: Built-in Hook Implementations

**Owner:** Runtime + Orchestrator teams  
**Effort:** ~2 hours

#### 1. Memory Pre-Turn Hook

```typescript
export function createMemoryPreTurnHook(): HookDefinition<'pre-turn'> {
  return {
    name: 'memory:pre-turn',
    event: 'pre-turn',
    priority: 100,
    handler: async (ctx) => {
      const relevant = await ctx.memory.retrieve({
        sessionId: ctx.sessionId,
        limit: 10,
        minRelevance: 0.6
      });

      ctx.context.memory = formatMemorySegment(relevant);
      return ctx;
    }
  };
}
```

Location: `packages/runtime/src/hooks/memory-pre-turn.ts`

#### 2. Memory Post-Turn Hook

```typescript
export function createMemoryPostTurnHook(): HookDefinition<'post-turn'> {
  return {
    name: 'memory:post-turn',
    event: 'post-turn',
    priority: 100,
    handler: async (ctx) => {
      const observations = extractObservations(ctx.lastTurn);
      await ctx.memory.capture({
        sessionId: ctx.sessionId,
        observations,
        sourceMessageId: ctx.lastMessageId
      });
      return ctx;
    }
  };
}
```

Location: `packages/runtime/src/hooks/memory-post-turn.ts`

#### 3. Skills Hook

```typescript
export function createSkillsHook(discoverer, activator): HookDefinition<'prepareStep'> {
  return {
    name: 'skills:activate',
    event: 'prepareStep',
    priority: 50,
    handler: async (ctx) => {
      const metadata = discoverer.discover(); // all skills, minimal content
      const active = await activator.activate(ctx.userMessage, metadata);

      ctx.activeSk skills = active;
      ctx.budget.allocate('skills', active.length * 500); // 500 tokens per skill
      return ctx;
    }
  };
}
```

#### 4. Instructions Hook

```typescript
export function createInstructionsHook(discoverer): HookDefinition<'beforeInit'> {
  return {
    name: 'instructions:inject',
    event: 'beforeInit',
    priority: 100,
    handler: async (ctx) => {
      const allInstructions = discoverer.discover(); // merged, precedence applied
      ctx.systemPrompt = composeSystemPrompt(allInstructions, ctx.model);
      ctx.budget.allocate('baseline', allInstructions.tokenCost);
      return ctx;
    }
  };
}
```

#### 5. Budget Hook

```typescript
export function createBudgetHook(budgetConfig): HookDefinition<'prepareStep'> {
  return {
    name: 'budget:enforce',
    event: 'prepareStep',
    priority: 10, // runs last
    handler: async (ctx) => {
      const remaining = ctx.budget.remaining();

      if (remaining < 100) {
        return { ...ctx, shouldAbort: true, reason: 'Budget exhausted' };
      }

      if (ctx.inputTokens > remaining * 0.5) {
        ctx.warningLevel = 'yellow';
      }

      return ctx;
    }
  };
}
```

#### 6. Approval Hook

```typescript
export function createApprovalHook(): HookDefinition<'pre-tool-call'> {
  return {
    name: 'runtime:approval-gate',
    event: 'pre-tool-call',
    priority: 100,
    enabled: true,
    handler: async (ctx) => {
      if (ctx.toolCall.annotations.destructiveHint) {
        const approved = await ctx.requestApproval({
          toolCallId: ctx.toolCall.id,
          toolName: ctx.toolCall.name,
          timeoutMs: 30000
        });

        if (!approved) {
          return { ...ctx, blocked: true, reason: 'User rejected' };
        }
      }

      return ctx;
    }
  };
}
```

#### 7. Observability Hook

```typescript
export function createObservabilityHook(tracer): HookDefinition<'onStep'> {
  return {
    name: 'observability:trace',
    event: 'onStep',
    priority: 5, // lowest; observes others
    handler: async (ctx) => {
      const span = tracer.startSpan('agent-step', {
        'agent.id': ctx.agentId,
        'session.id': ctx.sessionId,
        'step.count': ctx.stepCount
      });

      ctx.span = span;
      return ctx;
    }
  };
}
```

All exported from `packages/runtime/src/hooks/index.ts`

---

## 2. Plan Mode

### TASK-PLAN-001..003: Plan Mode Flag + Execution

**Owner:** Orchestrator + Runtime teams  
**Effort:** ~1 hour

```typescript
export interface SessionOptions {
  agentId: string;
  model?: string;
  plan?: boolean; // NEW
  autonomous?: boolean;
  approvalPolicy?: ApprovalPolicy;
}

export async function createAgentSession(
  agentDef: AgentDefinition,
  config: SessionOptions
): Promise<AgentLoopHandle> {
  const session = new AgentSession(agentDef, config);

  if (config.plan) {
    // Initialize session, set plan flag, skip tool execution
    session.mode = 'plan';
    session.hooks.disable('pre-tool-call'); // Tools → no-op
  }

  return session.handle();
}
```

All hooks run; tool-call hooks short-circuit to return structured plan instead.

**CLI integration:**

```bash
agentsy --plan
# OR
agentsy chat
/plan

# Outputs: structured plan document (tasks, dependencies, estimate)
```

---

## 3. Orchestrator CLI Integration

### TASK-061/062: Multi-Step Plan→Act

**Owner:** Orchestrator + CLI teams  
**Effort:** ~1.5 hours

```typescript
export async function orchestratedExecution(agentId: string, goal: string) {
  // 1. Plan phase: /plan flag
  const plan = await createAgentSession({ agentId, plan: true })
    .step(goal);

  // 2. User approval
  const approved = await requestUserApproval(plan.text);
  if (!approved) return;

  // 3. Execution phase
  const result = await createAgentSession({ agentId, autonomous: false })
    .runPlan(plan);

  return result;
}
```

Wire into CLI: `/mode orchestrated` sets default behavior.

---

## 4. Skills, Instructions, Agents Discovery

### TASK-SIA-001..010: Full Stack

**Owner:** Plugins team  
**Effort:** ~4 hours

#### TASK-SIA-001..004: Skills

```typescript
// packages/plugins/src/skills/manifest.ts
export interface SkillManifest {
  name: string; // ≤64 chars
  description: string; // ≤1024 chars
  version?: string;
  author?: string;
  license?: string;
}

// packages/plugins/src/skills/discoverer.ts
export class SkillDiscoverer {
  async discover(): Promise<SkillMetadata[]> {
    // Walk 5 roots, parse frontmatter only
    // Return minimal metadata (path, name, description, version)
  }
}

// packages/plugins/src/skills/activator.ts
export class SkillActivator {
  async activate(userMessage: string, metadata: SkillMetadata[]): Promise<ActiveSkill[]> {
    // Semantic match + relevance scoring
    // Load full body for matched skills
    // Return ordered by relevance
  }
}

// packages/plugins/src/skills/hook.ts
export function createSkillsHook(discoverer, activator) {
  return {
    name: 'skills:activate',
    event: 'prepareStep',
    handler: async (ctx) => {
      const metadata = discoverer.discover();
      const active = await activator.activate(ctx.userMessage, metadata);
      ctx.activeSkills = active;
    }
  };
}
```

**Discovery roots (highest → lowest):**

1. `<project>/.agents/` (project)
2. `~/.agents/` (user)
3. `~/.config/agentsy/skills/` (XDG config)
4. `$XDG_DATA_HOME/agentsy/skills/` (XDG data)
5. Bundled with CLI

#### TASK-SIA-005..007: Instructions

```typescript
// packages/plugins/src/instructions/types.ts
export interface InstructionFile {
  path: string;
  scope?: string; // 'global' | 'workspace' | specific scope
  alwaysInject: boolean;
  content: string;
  priority: number; // 0-100; higher = more important
  applyTo?: string; // glob pattern
}

// packages/plugins/src/instructions/discoverer.ts
export class InstructionsDiscoverer {
  async discover(): Promise<InstructionFile[]> {
    // 1. <project>/AGENTS.md
    // 2. <project>/CLAUDE.md
    // 3. <project>/.github/copilot-instructions.md
    // 4. <project>/.cursor/rules/*.md (glob + applyTo)
    // 5. ~/.agentsy/instructions.md
    // 6. ~/.config/agentsy/instructions.md

    // Merge all with priority precedence
    // Return ordered by priority (highest first)
  }
}

// packages/plugins/src/instructions/hook.ts
export function createInstructionsHook(discoverer) {
  return {
    name: 'instructions:inject',
    event: 'beforeInit',
    handler: async (ctx) => {
      const instructions = await discoverer.discover();
      ctx.systemPrompt = composeSystemPrompt(instructions);
      ctx.baselineBudget = instructions.sum(i => tokenCount(i.content));
    }
  };
}
```

#### TASK-SIA-008..010: Agent Definitions

```typescript
// packages/plugins/src/agents/definition.ts
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPromptTemplate?: string;
  allowedTools?: string[] | '*';
  memoryScopes?: ('session' | 'workspace' | 'user')[];
  orchestrationMode?: 'single' | 'orchestrated' | 'autonomous';
  defaultModel?: string;
  hooks?: Record<string, string>; // named hook refs
  source: 'bundled' | 'user' | 'workspace';
}

// packages/plugins/src/agents/loader.ts
export class AgentLoader {
  async load(agentId: string): Promise<AgentDefinition> {
    // 1. Search <project>/.agents/AGENT.md
    // 2. Search ~/.agents/AGENT.md
    // 3. Search ~/.config/agentsy/agents/AGENT.md
    // 4. Built-in agents

    return parse(content);
  }
}

export class AgentRegistry {
  async list(): Promise<AgentDefinition[]> {
    // All discoverable agents
  }

  async get(agentId: string): Promise<AgentDefinition> {
    return this.loader.load(agentId);
  }
}

// packages/plugins/src/agents/builtins/
export const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    id: 'default',
    name: 'Default Agent',
    description: 'General-purpose multi-mode',
    allowedTools: '*',
    orchestrationMode: 'single',
    source: 'bundled'
  },
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Iterative search + synthesis',
    allowedTools: ['search', 'memory_search', 'memory_append'],
    orchestrationMode: 'orchestrated',
    source: 'bundled'
  },
  {
    id: 'code',
    name: 'Code Agent',
    description: 'Structured code development',
    allowedTools: ['repl', 'fs_read', 'fs_write', 'git_*'],
    orchestrationMode: 'orchestrated',
    source: 'bundled'
  },
  {
    id: 'plan',
    name: 'Planner Agent',
    description: 'Interview-driven planning',
    allowedTools: ['memory_append'],
    orchestrationMode: 'single',
    source: 'bundled'
  },
  {
    id: 'superagent',
    name: 'Superagent',
    description: 'Multi-step orchestration with subagents',
    allowedTools: '*',
    orchestrationMode: 'autonomous',
    source: 'bundled'
  }
];
```

**Quality gates:**

- ✅ All loaders tested with fixtures
- ✅ Precedence order verified
- ✅ Built-in agents loadable

---

## 5. Official Superagents Plugin

### TASK-091 ✅ + TASK-092..093: Three Modes

**Status:** TASK-091 (manifest registry) completed Phase 0  
**Phase 4 work:** Implement three reusable agent modes

```typescript
// packages/plugins/src/agents/superagents/research.ts
export const researchAgentMode: AgentDefinition = {
  id: 'research',
  name: 'Research Mode',
  description: 'Iterative retrieval, synthesis, citation',
  systemPromptTemplate: `You are a research agent.
...
Mode: Iterative search → summarize → reflect with citations.`,
  allowedTools: ['search', 'memory_search', 'memory_append', 'retrieval_query'],
  orchestrationMode: 'orchestrated',
  source: 'bundled'
};

// packages/plugins/src/agents/superagents/plan.ts
export const planAgentMode: AgentDefinition = {
  id: 'plan',
  name: 'Plan Mode',
  description: 'Interview-driven clarification + approval gates',
  systemPromptTemplate: `You are a planning agent.
...
Interview the user, clarify requirements, propose plan, request approval.`,
  allowedTools: ['memory_append'],
  orchestrationMode: 'single',
  source: 'bundled'
};

// packages/plugins/src/agents/superagents/agent.ts
export const superagentMode: AgentDefinition = {
  id: 'superagent',
  name: 'Superagent Mode',
  description: 'Investigation, review, test gates, completion enforcement',
  systemPromptTemplate: `You are a superagent.
...
Investigate problem, create plan, delegate tasks, review results, enforce quality.`,
  allowedTools: '*',
  orchestrationMode: 'autonomous',
  source: 'bundled'
};
```

Pattern sources:

- minds-platform research flow
- Agent-S optional grounding/reflection
- local-deep-researcher iterative search
- superpowers (TDD + subagents)
- oh-my-openagent + Sisyphus (planner/conductor/worker)
- gstack (think→plan→build→review→test→ship→reflect)

---

## 6. Plugin Security

### TASK-PLUGIN-020..022: Sandboxing + Context Audit

**Owner:** Plugins team  
**Effort:** ~1.5 hours

#### 1. Context-Injection Allowlist

```typescript
// packages/plugins/src/security/allowed-context-fields.ts
const ALLOWED_CONTEXT_INJECTION_FIELDS = [
  'sessionId',
  'agentId',
  'model',
  'userMessage',
  'orchestrationMode',
  'memoryScopes',
  'timestamp',
  // NOT: systemPrompt, inputTokens, activeHooks, etc
];

export function filterContextForPlugin(
  context: AgentLoopContext,
  pluginId: string
): SafeContext {
  const safe: any = {};
  for (const field of ALLOWED_CONTEXT_INJECTION_FIELDS) {
    safe[field] = context[field];
  }
  return safe;
}
```

#### 2. ContextInjectionAudit

```typescript
// packages/plugins/src/audit/context-injections.ts
export interface ContextInjectionRecord {
  timestamp: Date;
  pluginId: string;
  pluginVersion: string;
  injectionPoint: 'system_prompt' | 'user_message' | 'tool_result' | 'assistant_message';
  contentHash: string; // SHA-256, never raw content
  contentLength: number;
}

export class ContextInjectionAuditor {
  record(plugin: PluginManifest, injection: ContextInjection) {
    const record: ContextInjectionRecord = {
      timestamp: new Date(),
      pluginId: plugin.id,
      pluginVersion: plugin.version,
      injectionPoint: injection.point,
      contentHash: sha256(injection.content),
      contentLength: injection.content.length
    };

    this.log.append(record);
  }

  auditTrail(sessionId: string): ContextInjectionRecord[] {
    return this.log.query({ sessionId });
  }
}
```

#### 3. Resource Sandboxing

```typescript
// packages/plugins/src/sandbox/index.ts
export interface SandboxOptions {
  memoryLimitMb?: number;
  timeoutMs?: number;
  allowedCapabilities?: string[];
}

export async function runPluginInSandbox(
  plugin: Plugin,
  entrypoint: string,
  args: unknown[],
  options: SandboxOptions = {}
): Promise<unknown> {
  const vm = new IsolatedVM({
    memoryLimitMb: options.memoryLimitMb || 64
  });

  // Expose only allowed APIs
  const hostAPI = {
    log: plugin.config.trusted ? console.log : undefined,
    // memory, time, etc — restricted
  };

  return vm.run(plugin.code, entrypoint, args, {
    timeout: options.timeoutMs || 5000,
    hostAPI
  });
}
```

#### 4. Documentation

```markdown
# Plugin Security Model

## Context Injection

Plugins can contribute to prompts. Contributions are audited:

- Content hash logged (never plaintext)
- Injection point recorded (system/user/tool/assistant)
- Plugin version tracked

## Resource Limits

Plugins run in isolated-vm:

- 64 MB memory (configurable)
- 5 second timeout (configurable)
- No FS/network without explicit host API

## Capability Declarations

Plugins must declare required capabilities:

```yaml
capabilities:
  - memory:read
  - memory:write
  - retrieval:search
```
```

## Trust Levels

- **Bundled** — Audited, auto-trusted
- **User-installed** — Audit trail, explicit approval required for FS/network
- **Workspace** — Project-level trust setting

```text

---

## 7. Secrets Broker

### TASK-065: Credential Broker Pattern

**Owner:** Secrets team  
**Effort:** ~1.5 hours  
**Location:** `packages/secrets/src/broker/`

```typescript
export interface CredentialRequest {
  toolCallId: string;
  sessionId: string;
  resourceType: 'github' | 'aws' | 'openai' | 'anthropic' | 'custom';
  requestedScopes: string[];
  justification: string;
  ttlSeconds?: number;
}

export interface IssuedCredential {
  id: string;
  encrypted: string; // Encrypted value
  expiresAt: Date;
  scopes: string[];
  meta: Record<string, unknown>;
}

export class CredentialBroker {
  async issue(request: CredentialRequest): Promise<IssuedCredential> {
    // Task-scoped credential (default 5 min TTL)
    const value = await this.keyring.get(request.resourceType);
    if (!value) throw new MissingCredentialError(request.resourceType);

    const encrypted = await encrypt(value);
    const credential: IssuedCredential = {
      id: uuidv4(),
      encrypted,
      expiresAt: new Date(Date.now() + (request.ttlSeconds || 300) * 1000),
      scopes: request.requestedScopes,
      meta: { resourceType: request.resourceType }
    };

    await this.auditLog.append({
      event: 'issued',
      credentialId: credential.id,
      request
    });

    return credential;
  }

  async revoke(credentialId: string) {
    // Early expiration
    await this.auditLog.append({ event: 'revoked', credentialId });
  }

  async listActive(sessionId: string): Promise<IssuedCredential[]> {
    return this.credentials.filter(
      c => c.expiresAt > new Date() && c.sessionId === sessionId
    );
  }
}
```

**Integration in runtime:**

```typescript
export async function executeToolCall(toolCall: ToolCall, ctx: AgentLoopContext) {
  if (toolCall.requiresCredential) {
    const credential = await ctx.secretsBroker.issue({
      toolCallId: toolCall.id,
      sessionId: ctx.sessionId,
      resourceType: toolCall.requiresCredential,
      requestedScopes: toolCall.scopes,
      justification: `Tool ${toolCall.name} requires ${toolCall.requiresCredential}`
    });

    // Pass decrypted credential to tool
    const result = await toolCall.execute({ credential });
  }
}
```

**Secret detection + redaction:**

```typescript
// packages/secrets/src/detection/index.ts
export function detectSecrets(text: string): SecretMatch[] {
  return [
    // AWS keys: AKIA[0-9A-Z]{16}
    ...detectAwsKeys(text),
    // GitHub: ghp_[a-zA-Z0-9]{36}
    ...detectGithubTokens(text),
    // Anthropic: sk-ant-[a-zA-Z0-9\-]{95}
    ...detectAnthropicKeys(text),
    // OpenAI: sk-[a-zA-Z0-9]{48}
    ...detectOpenaiKeys(text),
  ];
}

export function redactSecrets(text: string): { redacted: string; matches: SecretMatch[] } {
  const matches = detectSecrets(text);
  let redacted = text;

  for (const match of matches) {
    redacted = redacted.replace(match.value, `[REDACTED:${match.type}]`);
  }

  return { redacted, matches };
}

// Hook into PostToolCall
export function createSecretDetectionHook(): HookDefinition<'post-tool-call'> {
  return {
    name: 'security:secret-detection',
    event: 'post-tool-call',
    priority: 100,
    handler: async (ctx) => {
      const { redacted, matches } = redactSecrets(ctx.toolResult);

      if (matches.length > 0) {
        ctx.tracer.warn('secret_detected', {
          matchCount: matches.length,
          types: matches.map(m => m.type)
        });

        // Redact in context before returning
        ctx.toolResult = redacted;
        ctx.warningLevel = 'yellow';
      }

      return ctx;
    }
  };
}
```

---

## 8. Token Budget Enforcement

### TASK-063: Hard Caps

**Owner:** Tokens team  
**Effort:** ~1 hour  
**Location:** `packages/tokens/src/budget.ts`

```typescript
export interface TokenBudget {
  inputCap: number;
  outputCap: number;
  contextCap: number;
  perTurnCap?: number;
  perSessionCap?: number;
}

export class BudgetEnforcer {
  private spent = { input: 0, output: 0, context: 0 };

  canAccommodate(request: {
    inputTokens: number;
    estimatedOutputTokens: number;
  }): boolean {
    return (
      this.spent.input + request.inputTokens <= this.budget.inputCap &&
      this.spent.output + request.estimatedOutputTokens <= this.budget.outputCap
    );
  }

  recordUsage(usage: { input: number; output: number }) {
    this.spent.input += usage.input;
    this.spent.output += usage.output;

    if (this.spent.output > this.budget.outputCap * 0.8) {
      // Yellow warning
    }
    if (this.spent.output > this.budget.outputCap) {
      throw new BudgetExceededError('Output tokens exceeded');
    }
  }

  remaining(): number {
    return this.budget.outputCap - this.spent.output;
  }

  reset() {
    this.spent = { input: 0, output: 0, context: 0 };
  }
}
```

**Wire into phase prepareStep:**

```typescript
export function createBudgetHook(budget: TokenBudget): HookDefinition<'prepareStep'> {
  const enforcer = new BudgetEnforcer(budget);

  return {
    name: 'budget:enforce',
    event: 'prepareStep',
    priority: 10, // runs last
    handler: async (ctx) => {
      if (!enforcer.canAccommodate({
        inputTokens: ctx.inputTokens,
        estimatedOutputTokens: 1000 // conservative
      })) {
        return { ...ctx, shouldAbort: true, reason: 'Budget insufficient' };
      }

      return ctx;
    }
  };
}
```

---

## 9. Prompts Layer Types

### TASK-064: Composition Contracts

**Owner:** Prompts team  
**Effort:** ~0.5 hours  
**Location:** `packages/prompts/src/layers/`

```typescript
// packages/prompts/src/layers/instructions.ts
export interface InstructionsLayer {
  type: 'instructions';
  content: string;
  tokenCount: number;
  priority: number;
}

export class InstructionsComposer {
  compose(instructions: InstructionFile[]): InstructionsLayer {
    // Deterministic assembly
    // Highest priority first
    return {
      type: 'instructions',
      content: instructions
        .sort((a, b) => b.priority - a.priority)
        .map(i => i.content)
        .join('\n\n'),
      tokenCount: instructions.sum(i => tokenCount(i.content)),
      priority: instructions[0]?.priority || 0
    };
  }
}

// packages/prompts/src/layers/skills.ts
export interface SkillsLayer {
  type: 'skills';
  skills: { name: string; description: string }[];
  tokenCount: number;
}

export class SkillsComposer {
  compose(activeSkills: ActiveSkill[]): SkillsLayer {
    return {
      type: 'skills',
      skills: activeSkills.map(s => ({
        name: s.name,
        description: s.description
      })),
      tokenCount: activeSkills.sum(s => s.tokenCount)
    };
  }
}
```

**Budget model:**

```typescript
export function allocateBudget(
  totalBudget: number,
  layers: (InstructionsLayer | SkillsLayer)[]
): BudgetAllocation {
  const baselineTokens = layers
    .filter(l => l.type === 'instructions')
    .sum(l => l.tokenCount);

  const taskTokens = totalBudget - baselineTokens;

  return {
    baseline: baselineTokens,
    task: taskTokens,
    remaining: 0
  };
}
```

---

## 10. Renderers + CLI Agent Commands

### TASK-SIA-022..025: Agent Picker + Commands

**Owner:** Renderers + CLI teams  
**Effort:** ~1.5 hours

#### Agent Picker Component

```typescript
export const AgentPickerComponent: React.FC<AgentPickerProps> = ({
  agents,
  onSelect,
  searchable = true,
}) => {
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(0);

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box flexDirection=\"column\">
      {searchable && (
        <Input
          placeholder=\"Search agents...\"
          value={search}
          onChange={setSearch}
        />
      )}
      <Box flexDirection=\"column\">
        {filtered.map((agent, i) => (
          <Box key={agent.id}>
            <Text>{i === selected ? '▶' : ' '}</Text>
            <Text color={i === selected ? 'cyan' : 'white'}>
              {agent.name}
            </Text>
            <Text color=\"dim\">• {agent.orchestrationMode}</Text>
          </Box>
        ))}
      </Box>
      <Text color=\"dim\">↑↓ navigate | Enter select | Esc close</Text>
    </Box>
  );
};
```

#### CLI Commands

```bash
# Agent selection
agentsy --agent research      # Select agent
agentsy chat                  # Interactive picker if ambiguous
/agent research               # Switch mid-session
/agent list                   # Show all agents
/agent show research          # Describe agent

# Skills discovery
/skills list                  # All available skills
/skills show <name>           # Skill details
```

---

## Quality Gates

- ✅ All hooks tested (unit + integration)
- ✅ Plugin loaders tested with fixtures
- ✅ Secrets broker encrypted, audited
- ✅ Budget enforcement fail-closed
- ✅ Plan mode produces valid structured output
- ✅ `pnpm check-types` monorepo green
- ✅ `pnpm test` all new packages green

---

## Success Criteria

✅ Hook registry fully wired + extensible  
✅ Skills/instructions/agents discoverable + loadable  
✅ Plan mode functional  
✅ Plugin security enforced (sandbox + audit)  
✅ Secrets broker operational  
✅ Token budget enforced  
✅ Ready for Phase 5 tool execution  

---

**Next phase:** `08-PHASE-5-TOOLS-APPROVALS.md`
