Based on the architectural review I completed in the previous turn, combined with the attached file content, here is the fully detailed implementation plan incorporating all recommendations.

Agentsy Architecture Upgrade Plan
Phase 0: Foundation Prerequisites (Do First — Everything Depends on These)
These changes establish the correct architectural foundation. Starting agent-mode implementation without them means rewriting later.

P0-1: Create @agentsy/observability (New Package)
This package does not exist and must be created before anything else is instrumented.
Directory structure
packages/observability/
├── src/
│ ├── index.ts
│ ├── tracer.ts # OTel TracerProvider singleton
│ ├── spans.ts # Named span constants + helper functions
│ ├── instruments/
│ │ ├── runtime.ts # Auto-instrument hook lifecycle
│ │ ├── tools.ts # Instrument tool calls
│ │ ├── retrieval.ts # Instrument retrieval stages
│ │ ├── llm.ts # Instrument LLM API calls (token counts, cost, model)
│ │ └── memory.ts # Instrument compaction events
│ ├── exporters/
│ │ ├── otlp.ts # OTLP HTTP/gRPC export (LangSmith, Honeycomb, etc.)
│ │ ├── console.ts # Dev: pretty-print spans to stdout
│ │ └── langsmith.ts # LangSmith-specific adapter (uses @langchain/core/tracers)
│ ├── viewer/
│ │ ├── server.ts # Local SQLite-backed trace viewer HTTP server
│ │ └── ui.html # Minimal inline HTML viewer for local dev
│ └── types.ts # AgentsySpan, AgentsyTrace, SpanKind, SpanStatus types
├── package.json
└── IMPLEMENTATION-PLAN.md
Core implementation steps
tracer.ts: Initialize a NodeTracerProvider from @opentelemetry/sdk-node. Export a getTracer(name: string) function. The provider should be configured from env vars (OTEL_EXPORTER_OTLP_ENDPOINT, AGENTSY_TRACE_BACKEND). If no backend is configured, default to the local SQLite viewer. Call provider.register() once at package import time.
spans.ts: Export named constants for every span type in the system:
export const SpanNames = {
AGENT_RUN: 'agentsy.agent.run',
LLM_CALL: 'agentsy.llm.call',
TOOL_CALL: 'agentsy.tool.call',
RETRIEVAL_QUERY: 'agentsy.retrieval.query',
RETRIEVAL_RERANK: 'agentsy.retrieval.rerank',
MEMORY_COMPACT: 'agentsy.memory.compact',
MEMORY_RETRIEVE: 'agentsy.memory.retrieve',
HOOK_FIRE: 'agentsy.hook.fire',
PLUGIN_LOAD: 'agentsy.plugin.load',
CONTEXT_INJECT: 'agentsy.context.inject', // For the plugin audit
} as const
Export a withSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Attributes): Promise<T> helper that wraps any async operation in a span and records errors automatically.
instruments/llm.ts: Wraps every generate()/stream() call with a span that records: llm.model, llm.provider, llm.input_tokens, llm.output_tokens, llm.latency_ms, llm.cost_usd (computed from token counts + provider pricing table), llm.finish_reason, llm.request_id.
instruments/tools.ts: Wraps every execute() call with a span recording: tool.name, tool.args (JSON-serialized, with PII redaction), tool.result_content_hash (the content-address), tool.latency_ms, tool.is_cached (boolean, true if result was content-addressed hit).
viewer/server.ts: A lightweight Express server (port 4318 by default) that persists spans to a SQLite database via better-sqlite3. Serves the HTML viewer at /. The viewer shows: trace timeline, span tree, attribute table, token cost summary. This is the local development experience.
package.json dependencies: @opentelemetry/sdk-node, @opentelemetry/api, @opentelemetry/exporter-trace-otlp-http, @opentelemetry/instrumentation-http, better-sqlite3, express.

P0-2: Runtime Hook Taxonomy Upgrade (@agentsy/runtime)
Add missing hook types to src/hooks/types.ts
// Existing hooks (keep)
type PreToolCallHook = ...
type PostToolCallHook = ...
type PreResponseHook = ...
type PostResponseHook = ...
type StopHook = ...

// NEW: Add these
type UserPromptSubmitHook = {
event: 'UserPromptSubmit'
handler: (ctx: UserPromptCtx) => Promise<UserPromptResult>
// ctx includes: rawInput, sessionId, userId, conversationHistory
// result: { allow: true } | { block: true; reason: string } | { transform: string }
// Use for: PII scrubbing, rate limiting, input classification, injection detection
}

type PreCompactHook = {
event: 'PreCompact'
handler: (ctx: PreCompactCtx) => Promise<PreCompactResult>
// ctx includes: messages, contextWindowUsed, contextWindowLimit
// result: { pin: MessageId[] } — message IDs to preserve through compaction
// The runtime MUST NOT compact pinned messages
}

type SubagentStopHook = {
event: 'SubagentStop'
handler: (ctx: SubagentCtx) => Promise<void>
// ctx includes: subagentId, parentSessionId, result, exitReason
// Use for: propagating subagent results to parent session, cleanup
}
Add the deterministic/probabilistic axiom
In src/index.ts and ARCHITECTURE.md (create if it doesn't exist), add the following as a documented invariant:
The Hook/Prompt Axiom: Safety logic MUST be implemented in hooks (deterministic), never in system prompts (probabilistic). A hook that returns { block: true } cannot be overridden by model output. A system prompt instruction can be. This is not a preference — it is the primary security boundary.
Add Guardrail middleware interface
Create src/guardrails/types.ts:
export type GuardrailResult =
| { pass: true }
| { block: true; reason: string; code: GuardrailCode }
| { transform: true; newInput: string; reason: string }

export type Guardrail = {
name: string
description: string
phase: 'input' | 'output' | 'tool_call' | 'tool_result'
run: (ctx: GuardrailCtx) => Promise<GuardrailResult>
}

export type GuardrailCtx = {
sessionId: string
content: string
phase: Guardrail['phase']
meta Record<string, unknown>
span: Span // OTel span from @agentsy/observability
}
Create src/guardrails/registry.ts: A GuardrailRegistry class with register(guardrail: Guardrail), runPhase(phase, ctx): Promise<GuardrailResult>, and list(): Guardrail[]. The registry runs guardrails for a given phase sequentially and short-circuits on the first block.
Implement built-in guardrails in src/guardrails/builtin/:
• secret-detection.ts: Scans tool results for patterns matching known secret formats (AWS keys, GitHub tokens, etc.) before they enter the model's context
• prompt-injection.ts: Scores input for injection patterns using a heuristic classifier
• pii-scrubbing.ts: Replaces PII patterns with redacted placeholders in the context (not in the audit log)

P0-3: Session Typed State Architecture (@agentsy/session)
Replace the current untyped state blob with a typed schema + reducer model
Create src/state/schema.ts:
import { z } from 'zod'

export const SessionStateSchema = z.object({
version: z.literal(1),
sessionId: z.string().uuid(),
threadId: z.string().uuid(), // Two-level identity: session + thread
parentSessionId: z.string().uuid().nullable(),
parentThreadId: z.string().uuid().nullable(),
messages: z.array(MessageSchema),
toolCallQueue: z.array(PendingToolCallSchema),
checkpoints: z.array(CheckpointRefSchema),
pinnedMessageIds: z.array(z.string()), // For PreCompact hook
meta z.record(z.unknown()),
createdAt: z.string().datetime(),
updatedAt: z.string().datetime(),
})

export type SessionState = z.infer<typeof SessionStateSchema>
Create src/state/reducers.ts:
// Each field has a typed reducer. Concurrent updates are merged safely.
export type StateReducers = {
messages: (current: Message[], patch: MessagesAction) => Message[]
toolCallQueue: (current: PendingToolCall[], patch: ToolQueueAction) => PendingToolCall[]
pinnedMessageIds: (current: string[], patch: PinAction) => string[]
meta (current: Record<string, unknown>, patch: Record<string, unknown>) => Record<string, unknown>
}

export const defaultReducers: StateReducers = {
messages: (current, action) => {
if (action.type === 'append') return [...current, ...action.messages]
if (action.type === 'replace') return action.messages
if (action.type === 'truncate') return current.slice(0, action.keepCount)
return current
},
// ... etc
}
Add branching support
Create src/branch.ts:
export async function forkSession(
sessionId: string,
forkPoint: CheckpointId,
store: SessionStore
): Promise<SessionState> {
const source = await store.loadCheckpoint(sessionId, forkPoint)
return store.save({
...source,
sessionId: crypto.randomUUID(),
threadId: crypto.randomUUID(),
parentSessionId: sessionId,
parentThreadId: source.threadId,
checkpoints: [],
createdAt: new Date().toISOString(),
updatedAt: new Date().toISOString(),
})
}
Add human-in-the-loop pause points
Create src/pause.ts:
export type PausePoint = {
id: string
sessionId: string
reason: string
pendingAction: SerializedAction
requiredApprovals: ApprovalSpec[]
status: 'pending' | 'approved' | 'denied'
createdAt: string
resolvedAt: string | null
}

export class PauseManager {
async requestApproval(sessionId: string, action: SerializedAction, spec: ApprovalSpec[]): Promise<boolean>
async listPending(sessionId: string): Promise<PausePoint[]>
async resolve(pauseId: string, approved: boolean, approvedBy: string): Promise<void>
}
The runtime's agent loop must check pause.requestApproval() before executing any tool with destructiveHint: true.
Add pluggable persistence adapters
Create src/adapters/:
adapters/
├── interface.ts # SessionStore interface: get/put/list/delete/loadCheckpoint/saveCheckpoint
├── sqlite.ts # better-sqlite3 implementation (local default)
├── postgres.ts # pg implementation (server deployment)
└── memory.ts # In-memory implementation (testing)
The SessionStore interface:
export interface SessionStore {
load(sessionId: string): Promise<SessionState | null>
save(state: SessionState): Promise<SessionState>
delete(sessionId: string): Promise<void>
list(filter?: SessionFilter): Promise<SessionSummary[]>
saveCheckpoint(sessionId: string, label?: string): Promise<CheckpointRef>
loadCheckpoint(sessionId: string, checkpointId: CheckpointId): Promise<SessionState>
listCheckpoints(sessionId: string): Promise<CheckpointRef[]>
}

Phase 1: Secrets and Security Hardening

P1-1: Credential Broker Model (@agentsy/secrets)
Reframe from static keychain to credential broker
The fundamental model change: the secrets package no longer just retrieves stored credentials. It issues task-scoped, short-lived derived credentials.
Create src/broker/index.ts:
export class CredentialBroker {
constructor(private store: SecretStore, private auditLog: AuditLog) {}

async issue(request: CredentialRequest): Promise<IssuedCredential> {
// Validates the request against the policy for the requested resource
// Logs the issuance with: toolCallId, taskId, sessionId, requestedScopes, expiresAt
// Returns a short-lived credential (default TTL: 5 minutes or until tool call completes)
}

async revoke(credentialId: string): Promise<void>

async listActive(sessionId: string): Promise<IssuedCredential[]>
}

export type CredentialRequest = {
toolCallId: string
sessionId: string
resourceType: 'github' | 'aws' | 'openai' | 'anthropic' | 'custom'
requestedScopes: string[]
justification: string // Why this tool needs this credential
ttlSeconds?: number // Default: 300
}

export type IssuedCredential = {
id: string
value: string // The actual credential value, encrypted at rest
expiresAt: string
scopes: string[]
meta CredentialRequest
}
Create src/audit/index.ts:
export interface CredentialAuditEntry {
id: string
event: 'issued' | 'accessed' | 'expired' | 'revoked'
credentialId: string
toolCallId: string
sessionId: string
resourceType: string
scopes: string[]
timestamp: string
callerIdentity: string
}

export class AuditLog {
async append(entry: CredentialAuditEntry): Promise<void>
async query(filter: AuditFilter): Promise<CredentialAuditEntry[]>
}
Migrate keytar → @napi-rs/keyring
In package.json, replace "keytar" with "@napi-rs/keyring". Update src/stores/keychain.ts to use the new API — the surface is nearly identical but @napi-rs/keyring is actively maintained and has proper macOS Sequoia support.
Add secret detection at tool output boundaries
In src/detection/index.ts:
const SECRET*PATTERNS = [
{ name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g },
{ name: 'github_token', pattern: /ghp*[a-zA-Z0-9]{36}/g },
{ name: 'anthropic_key', pattern: /sk-ant-[a-zA-Z0-9\-]{95}/g },
{ name: 'openai_key', pattern: /sk-[a-zA-Z0-9]{48}/g },
// ... etc
]

export function detectSecrets(content: string): DetectedSecret[]
export function redactSecrets(content: string): { redacted: string; detections: DetectedSecret[] }
Wire this into the PostToolCall hook in @agentsy/runtime — every tool result is scanned before being appended to the context. If a secret is detected, the result is redacted, a warning span is emitted to @agentsy/observability, and the human-in-the-loop pause manager is notified.

Phase 2: Tool System MCP Compliance

P2-1: Required Tool Annotations (@agentsy/tools)
Make MCP annotations required at registration time
Update src/registry/types.ts:
export type ToolDefinition = {
name: string
description: string
inputSchema: z.ZodSchema
outputSchema: z.ZodSchema
// MCP 2025 annotations — ALL REQUIRED, no optional
annotations: {
readOnlyHint: boolean // true = no side effects
destructiveHint: boolean // true = requires human approval
idempotentHint: boolean // true = safe to retry
openWorldHint: boolean // true = interacts with external systems
requiresCredential?: string // credential resource type if needed
progressNotifications?: boolean // true = emits progress events
}
execute: (args: unknown, ctx: ToolCallCtx) => Promise<ToolResult>
}
Any call to registry.register(tool) where annotations is missing or incomplete throws a ToolAnnotationError at registration time (not at execution time).
Update src/registry/index.ts to expose list(cursor?: string, limit?: number): ToolListPage for pagination.
Add progress notifications
Create src/progress/index.ts:
export type ProgressNotification = {
toolCallId: string
progressToken: string | number
progress: number // 0-100
total?: number
message?: string
}

export class ProgressEmitter extends EventEmitter {
emit(notification: ProgressNotification): void
onProgress(toolCallId: string, handler: (n: ProgressNotification) => void): () => void
}
The ToolCallCtx passed to execute() should include a progress: ProgressEmitter reference. Long-running tools call ctx.progress.emit({ progress: 50, message: 'Halfway done' }).
The CLI subscribes to progress notifications and renders progress bars.
REPL kernel persistence model
In src/repl/kernel.ts, clarify the lifecycle:
• One kernel per session (not per turn)
• kernel.reset() is opt-in, not the default
• Kernel state is included in session checkpoints
• The kernel ID is logged to observability with every REPL tool call span

Phase 3: Plugin System Security

P3-1: Context-Injection Audit (@agentsy/plugins)
Add Layer 4: Context-injection audit trail
Create src/audit/context-injections.ts:
export type ContextInjectionRecord = {
id: string
sessionId: string
pluginId: string
pluginVersion: string
injectionPoint: 'system_prompt' | 'user_message' | 'tool_result' | 'assistant_message'
contentHash: string // SHA-256 of the injected content
contentLength: number
timestamp: string
// The actual content is NOT stored here — only the hash.
// If you need to review the content, look it up by contentHash in the session store.
}

export class ContextInjectionAudit {
async record(record: ContextInjectionRecord): Promise<void>
async query(sessionId: string): Promise<ContextInjectionRecord[]>
async verifyIntegrity(sessionId: string): Promise<AuditIntegrityResult>
}
Every time a plugin calls ctx.injectSystemPrompt(), ctx.appendToContext(), or any context-modification API, the audit record is created automatically by the plugin host — the plugin does not call this directly.
Add SKILL.md convention
Create src/skills/loader.ts:
export async function loadPluginSkill(pluginRoot: string): Promise<string | null> {
// Looks for SKILL.md at the plugin root
// Returns the content if found, null if not
// Called by the plugin loader at activation time
}

export function buildSkillSystemPrompt(activeSkills: PluginSkill[]): string {
// Builds the skills section of the system prompt from all active plugins
// Each plugin's SKILL.md content is prefixed with a plugin attribution header
// Content is length-bounded: each plugin gets max 2000 chars of skill content
}
All plugins should ship a SKILL.md at their package root. The format:

# [Plugin Name]

## What this plugin does

[1-2 sentence summary for the model]

## Available tools

- `tool_name`: [one-line description]

## When to use this plugin

[Guidance for the model on when to invoke these tools]

## Limitations

[What this plugin cannot do]
Add execution sandbox
Create src/sandbox/index.ts using isolated-vm:
import ivm from 'isolated-vm'

export class PluginSandbox {
private isolate: ivm.Isolate
private context: ivm.Context

constructor(private pluginId: string, private memoryLimitMb: number = 64) {
this.isolate = new ivm.Isolate({ memoryLimit: memoryLimitMb })
this.context = this.isolate.createContextSync()
}

async execute<T>(code: string, args: Record<string, unknown>): Promise<T>
async dispose(): Promise<void>

// Called by the plugin host to expose safe APIs to the sandbox
exposeHostAPI(name: string, fn: (...args: unknown[]) => Promise<unknown>): void
}
Sandboxed plugins get access only to explicitly exposed host APIs. They cannot access the filesystem, network, or Node.js builtins unless the host exposes wrappers for them. Native (trusted) plugins can opt out of sandboxing via a trusted: true flag in their package.json agentsy config section, but this requires explicit user approval at install time.

Phase 4: Provider and Retrieval Upgrades

P4-1: Structured Output as First-Class Primitive (@agentsy/providers)
Add schema parameter to generate()
Update src/interface.ts:
export type GenerateOptions = {
messages: Message[]
tools?: ToolDefinition[]
schema?: z.ZodSchema // NEW: structured output mode
schemaRetries?: number // NEW: default 3
maxTokens?: number
temperature?: number
stopSequences?: string[]
stream?: false
}

export type StreamOptions = Omit<GenerateOptions, 'stream'> & { stream: true }
When schema is provided:
1 If the provider supports native structured output (OpenAI response_format, Anthropic tool-use trick), use it
2 The provider implementation parses the response against the schema using schema.safeParse()
3 If parsing fails, retry up to schemaRetries times with the parse error appended to the messages
4 If all retries fail, throw a StructuredOutputError with the raw output and parse errors
Add provider middleware
Create src/middleware/types.ts:
export type ProviderMiddleware = {
name: string
onRequest?: (req: GenerateOptions) => Promise<GenerateOptions>
onResponse?: (res: GenerateResult, req: GenerateOptions) => Promise<GenerateResult>
onError?: (err: Error, req: GenerateOptions) => Promise<never | GenerateResult>
}
Create src/middleware/builtin/:
• cost-tracker.ts: Accumulates token counts → computes cost → emits to @agentsy/observability
• semantic-cache.ts: Hashes the messages array → checks SQLite cache → returns cached response if hit
• retry.ts: Implements exponential backoff with jitter for rate limits and transient errors
• circuit-breaker.ts: Tracks error rates per provider → trips circuit after N failures in window
Runtime capability discovery
Replace the static capability map with a runtime probe:
// src/capabilities/probe.ts
export async function probeCapabilities(provider: Provider): Promise<CapabilityMap> {
// Runs a minimal test request to probe: tool_use, structured_output, vision, streaming
// Caches the result with a 24-hour TTL
// Falls back to a conservative static map if the probe fails
}

P4-2: Full 4-Stage RAG Pipeline (@agentsy/retrieval)
Stage 1: Query Processing
Create src/query/:
processor.ts:
export class QueryProcessor {
async process(query: string, ctx: QueryCtx): Promise<ProcessedQuery> {
const classification = await this.classify(query)
const rewritten = await this.rewrite(query, classification)
return { original: query, rewritten, classification }
}

private async classify(query: string): Promise<QueryClassification>
// Returns: 'factual_lookup' | 'reasoning' | 'creative' | 'multi_hop'

private async rewrite(query: string, cls: QueryClassification): Promise<string>
// Implements HyDE for factual_lookup and multi_hop:
// 1. Ask the model: "Write a hypothetical answer to: {query}"
// 2. Embed the hypothetical answer instead of the query
// 3. Use the hypothetical answer's embedding for retrieval
}
Stage 2: Hybrid Retrieval with RRF
Update src/retrieval/hybrid.ts:
export async function hybridRetrieve(
query: ProcessedQuery,
stores: { sparse: SparseIndex; dense: VectorIndex },
options: { topK: number; rrf_k: number }
): Promise<RetrievedChunk[]> {
const [sparseResults, denseResults] = await Promise.all([
stores.sparse.search(query.rewritten, { topK: options.topK * 2 }),
stores.dense.search(query.rewritten, { topK: options.topK * 2 }),
])

// Reciprocal Rank Fusion
return rrfFuse([sparseResults, denseResults], { k: options.rrf_k ?? 60, topK: options.topK })
}

function rrfFuse(rankings: ScoredChunk[][], options: { k: number; topK: number }): RetrievedChunk[] {
const scores = new Map<string, number>()
for (const ranking of rankings) {
ranking.forEach((chunk, index) => {
const prev = scores.get(chunk.id) ?? 0
scores.set(chunk.id, prev + 1 / (options.k + index + 1))
})
}
return [...scores.entries()]
.sort(([, a], [, b]) => b - a)
.slice(0, options.topK)
.map(([id, score]) => ({ ...chunkById(id), rrfScore: score }))
}
Stage 3: Reranking
Create src/reranking/index.ts:
export interface Reranker {
rerank(query: string, chunks: RetrievedChunk[], topN: number): Promise<RankedChunk[]>
}

export class CohereReranker implements Reranker { ... }
export class BGEReranker implements Reranker { ... } // Local model via ONNX
export class PassthroughReranker implements Reranker { ... } // No-op for dev/testing

// The factory reads AGENTSY_RERANKER from env: 'cohere' | 'bge' | 'none'
export function createReranker(config: RerankerConfig): Reranker
Stage 4: Context Builder
Create src/context/builder.ts:
export class ContextBuilder {
constructor(private tokenCounter: TokenCounter) {}

build(
chunks: RankedChunk[],
options: {
maxTokens: number
ordering: 'relevance' | 'recency' | 'lost-in-middle'
// 'lost-in-middle': most relevant chunks at start + end, less relevant in middle
}
): BuiltContext {
// Packs chunks into the token budget
// 'lost-in-middle' ordering: alternately places chunks at start and end
// Returns: { text: string; citations: CitationMap; tokenCount: number }
}
}

export type CitationMap = Map<string, { chunkId: string; source: string; page?: number }>
Chunking strategy
Create src/chunking/:
chunking/
├── hierarchical.ts # Paragraph-level parent + sentence-level children (RECOMMENDED DEFAULT)
├── fixed.ts # Fixed-size with overlap (fast, lower quality)
├── semantic.ts # Cluster sentences by embedding similarity (slow, highest quality)
└── index.ts # ChunkingStrategy interface + factory
The hierarchical.ts implementation: index both sentence-level chunks and their parent paragraphs. Retrieve at sentence granularity (better precision), return paragraph context (better recall). Store the parentChunkId on every sentence chunk.

Phase 5: LLM Gateway (@agentsy/load-balancer → @agentsy/gateway)
Rename and expand scope
Rename the package from load-balancer to gateway. Update all internal references and package.json exports.
Add semantic routing
Create src/routing/semantic.ts:
export type RoutingRule = {
name: string
description: string
classifier: (request: GatewayRequest) => Promise<boolean>
targetProvider: string
targetModel: string
priority: number
}

export const builtinRules: RoutingRule[] = [
{
name: 'simple-factual',
description: 'Short factual queries go to fast/cheap models',
classifier: async (req) => isSimpleFactual(req.messages),
targetProvider: 'openai',
targetModel: 'gpt-4o-mini',
priority: 10,
},
{
name: 'code-generation',
description: 'Code generation goes to code-specialized models',
classifier: async (req) => hasCodeGenerationIntent(req.messages),
targetProvider: 'anthropic',
targetModel: 'claude-opus-4-5',
priority: 20,
},
]
Add semantic cache
Create src/cache/semantic.ts:
export class SemanticCache {
constructor(private db: Database, private embedder: EmbeddingFn) {}

async get(messages: Message[], threshold: number = 0.97): Promise<CacheHit | null> {
const embedding = await this.embedder(serializeMessages(messages))
// Cosine similarity search against cached embeddings
// Returns hit if similarity > threshold
}

async set(messages: Message[], response: GenerateResult): Promise<void>
async invalidate(pattern: string): Promise<void>
}
Unified audit log
Create src/audit/index.ts:
export type GatewayAuditEntry = {
id: string
timestamp: string
sessionId: string
requestId: string
provider: string
model: string
modelVersion: string // Exact version, not alias
inputTokens: number
outputTokens: number
costUsd: number
latencyMs: number
cacheHit: boolean
routingRule: string | null
finishReason: string
// Prompt/completion are NOT stored here by default (PII risk)
// Set AGENTSY_AUDIT_STORE_PROMPTS=true to enable (requires explicit consent)
}
Version pinning
In src/config/models.ts, every model alias resolves to an explicit version:
export const MODEL_VERSIONS = {
'claude-opus': 'claude-opus-4-5-20251101',
'claude-sonnet': 'claude-sonnet-4-5-20251101',
'gpt-4o': 'gpt-4o-2024-11-20',
// ...
} as const
The gateway always sends the pinned version string, never the alias, to the provider API. Aliases are resolved at request time, not at config time, so the mapping can be updated without restarting.

Phase 6: CLI Agent Mode

P6-1: Input Classification Pipeline
Create packages/cli/src/input/classifier.ts:
export type InputClassification =
| { type: 'slash_command'; command: string; args: string[] }
| { type: 'agent_task'; taskDescription: string; isNewTask: boolean }
| { type: 'conversation_continuation'; content: string }
| { type: 'clarification_response'; content: string }
| { type: 'empty' }

export async function classifyInput(
rawInput: string,
sessionState: SessionState | null
): Promise<InputClassification> {
if (rawInput.startsWith('/')) return parseSlashCommand(rawInput)
if (!sessionState || sessionState.messages.length === 0) {
return { type: 'agent_task', taskDescription: rawInput, isNewTask: true }
}
// Heuristic: short follow-up after the model asked a question = continuation
const lastModelMessage = getLastAssistantMessage(sessionState)
if (lastModelMessage?.endsWithQuestion && rawInput.length < 200) {
return { type: 'clarification_response', content: rawInput }
}
if (looksLikeNewTask(rawInput)) {
return { type: 'agent_task', taskDescription: rawInput, isNewTask: true }
}
return { type: 'conversation_continuation', content: rawInput }
}
/ command namespace
Create packages/cli/src/commands/slash/:
slash/
├── index.ts # Router: maps /command → handler
├── compact.ts # /compact — trigger context compaction
├── clear.ts # /clear — clear session history
├── model.ts # /model [name] — switch model mid-session
├── tools.ts # /tools — list available tools
├── history.ts # /history — show conversation history
├── session.ts # /session [save|load|list] — session management
├── plugins.ts # /plugins — list active plugins
└── help.ts # /help — show all slash commands
Add --continue and --resume flags
In packages/cli/src/index.ts, the main agent command:
agentsy agent [task]
--continue Resume the most recent session
--resume <id> Resume a specific session by ID
--model <name> Override the configured model
--provider <name> Override the configured provider
--json Output in machine-readable JSON (non-interactive)
--no-stream Disable streaming (for piped/scripted use)
Ink + reducer architecture
Create packages/cli/src/ui/:
ui/
├── App.tsx # Root Ink component
├── store.ts # useReducer state: messages, streaming, toolCalls, progress, mode
├── reducers.ts # All state transitions
├── components/
│ ├── MessageList.tsx
│ ├── StreamingMessage.tsx # Shows token-by-token streaming
│ ├── ToolCallCard.tsx # Shows tool name, args, result, duration
│ ├── ProgressBar.tsx # For tools that emit progress notifications
│ ├── PausePrompt.tsx # Human-in-the-loop approval UI
│ └── SlashCommandHelp.tsx
└── non-interactive.ts # Plain stdout renderer (same state, no Ink) for --json and CI
The non-interactive.ts renderer reads from the same state store but writes NDJSON to stdout. This enables scripting: agentsy agent "list open GitHub issues" --json | jq '.toolCalls[].result'.

Phase 7: Config System Hardening

P7-1: XDG Compliance and Schema Versioning (@agentsy/config)
XDG Base Directory paths
In src/paths.ts:
import { env, platform } from 'process'
import { join } from 'path'
import { homedir } from 'os'

function xdgConfigHome(): string {
return env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
}

function xdgDataHome(): string {
return env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share')
}

function xdgCacheHome(): string {
return env.XDG_CACHE_HOME ?? join(homedir(), '.cache')
}

export const PATHS = {
config: join(xdgConfigHome(), 'agentsy'),
join(xdgDataHome(), 'agentsy'),
cache: join(xdgCacheHome(), 'agentsy'),
// macOS also respects ~/Library/Application Support for GUI apps,
// but CLI tools should use XDG for cross-platform compatibility
} as const
Project-level config inheritance
The config loader resolution order (highest to lowest priority):
1 Environment variables (AGENTSY\_\*)
2 Project config (.agentsy/config.json in current directory, walking up to git root)
3 User config (~/.config/agentsy/config.json)
4 Defaults
Deep merge with explicit override semantics: arrays at the project level replace (not append to) arrays at the user level.
Schema versioning + migration
In src/schema/versions/:
versions/
├── v1.ts # Initial schema
├── v2.ts # Add observability config (migration: set defaults)
├── v3.ts # Current
└── index.ts # getMigrationPath(from, to): Migration[]
On config load, if config.version < CURRENT_VERSION, run migrations in sequence. Write the migrated config back. Log the migration to stderr in verbose mode.
Structural secret separation
The config TypeScript type must not have any field that could hold a secret:
// CORRECT
export type AgentsyConfig = {
version: number
defaultProvider: string
defaultModel: string
observability: ObservabilityConfig
// NO apiKey, NO token, NO password fields
}

// Secrets are accessed ONLY via @agentsy/secrets
// The config schema enforces this at the type level

Phase 8: Memory System Completion

P8-1: Fact Extraction Pipeline and Memory-as-Tool (@agentsy/memory)
Tier 3: Fact extraction
Create src/extraction/:
// index.ts
export class FactExtractor {
async extract(turn: ConversationTurn): Promise<ExtractedFact[]> {
// Calls the model with a structured extraction prompt
// Returns: facts with type (preference, entity, procedure, constraint, etc.)
}
}

export type ExtractedFact = {
id: string
content: string
type: 'user_preference' | 'entity' | 'procedure' | 'constraint' | 'task_context'
confidence: number
sourceMessageId: string
embedding?: number[]
createdAt: string
expiresAt: string | null // null = permanent
}
Memory write as an agent tool
Register these tools in the default tool registry (they are always available to the agent):
const coreMemoryTools: ToolDefinition[] = [
{
name: 'memory_append',
description: 'Store a new fact or preference in long-term memory',
inputSchema: z.object({ content: z.string(), type: z.string(), expiresInDays: z.number().optional() }),
annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
execute: async (args, ctx) => memoryStore.append(ctx.sessionId, args),
},
{
name: 'memory_search',
description: 'Search long-term memory for relevant facts',
inputSchema: z.object({ query: z.string(), limit: z.number().default(5) }),
annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
execute: async (args, ctx) => memoryStore.search(ctx.sessionId, args.query, args.limit),
},
]
Explicit compaction strategy
In IMPLEMENTATION-PLAN.md, document the chosen strategy: retrieval-augmented compaction (not summarization-based). Implementation:
1 When context usage exceeds compactionThreshold (default: 80% of context window), fire PreCompact hook to collect pinned message IDs
2 Move all non-pinned messages older than the most recent N turns to the episodic store
3 Embed them and store with the session ID
4 At the start of each subsequent turn, retrieve the top-K most relevant episodic memories via semantic search and prepend them to the context as a <memory> block

Cross-Cutting: Turbo Pipeline and Package Wiring
Update turbo.json
Add @agentsy/observability to the dependency graph so it builds before all packages that import it:
{
"tasks": {
"build": {
"dependsOn": ["^build"],
"outputs": ["dist/**"]
},
"@agentsy/observability#build": {
"dependsOn": [],
"outputs": ["dist/**"]
}
}
}
Update pnpm-workspace.yaml
Add:
packages:

- 'packages/\*'

## New packages

- 'packages/observability'
- 'packages/gateway' # renamed from load-balancer
  Package dependency additions (per package)
  Package Add dependency @agentsy/runtime @agentsy/observability, @agentsy/secrets @agentsy/tools @agentsy/observability, @agentsy/secrets @agentsy/plugins @agentsy/observability, isolated-vm @agentsy/session @agentsy/observability, better-sqlite3, pg@agentsy/retrieval @agentsy/observability, cohere or onnxruntime for reranker @agentsy/memory @agentsy/observability, @agentsy/retrieval @agentsy/providers @agentsy/observability @agentsy/gateway @agentsy/observability, @agentsy/providers @agentsy/cli@agentsy/observability, ink, react @agentsy/secrets @napi-rs/keyring (replace keytar)

Implementation Order Summary
Phase Package(s) Why First P0 observability (create), runtime (hooks), session (typed state) Everything else depends on these — no debugging without traces, no correctness without typed state P1 secrets (credential broker) Required before any tool that calls external APIs P2 tools (MCP compliance) Required before the CLI agent loop can be wired up P3 plugins(security) Required before plugins are loaded in agent sessions P4 providers (structured output), retrieval (4-stage) Feature completeness for the agent loop P5 gateway (LLM gateway) Operational quality — observability + routing + caching P6 cli(agent mode) Final wiring — now all foundations are correct P7 config (XDG + versioning) Housekeeping, low risk, can be done in parallel with P4 P8 memory (fact extraction + tools) Builds on retrieval, can be done after P4
Sources [1] pasted_text_1779695145.txt <https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/1170195394/21019bec-8af4-4a52-8f7b-a88e8dac76ed/pasted_text_1779695145.txt?AWSAccessKeyId=ASIA2F3EMEYEXLJI7TSV&Signature=Rw4NCKlP%2Be%2F6V%2FAxpE4ntDnyfVQ%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJGMEQCICTfTxI9Kj7X5bTpx30Kqj3qeLuVqqQGNs%2BrOoUBjHXUAiBInKvB5i5ZnXjtiEKXEed5J6M7AUdGXpFwUv8RR4C2DyrzBAhhEAEaDDY5OTc1MzMwOTcwNSIMlo8OMz%2FR3RgP9Gm3KtAE%2B0eEVV8iuaXsKpP5J8x5K1dHeThE6OAe9QigShWJuMCGC8jJOncPGh6aZUvYrj2DtJh1FWclovoMIYVlyc3J7p11MWIZVV8yJtWOjn76qvEKaWNDCK770LFomNA4KYT8d8URJ5fRo57lQtTAcW1Noy9oX2cGrcz2KcyHrqg%2FT6%2B6wTuXk6JI0FiWMENmDojuuL9PLn8UlfpdOG%2BXxuobi4fIRp3Bhh20eL5zX2AG7oZbcOjZMwBM6vIhLKvvwr6xWYS5jNViOQviITOr2V%2FNnZpJDt5F4L%2BIG0IlaOHrYHFw1Y345bYbztSB7Hg7VOVEy5Yz9znIQi9xGra%2FylcAPL43DrS7U5YN2aoNyu12LRbct9Gj7sDR%2FuBZ8%2FPQIy1yLRhPYMYHNopL%2BhBhLt52L4ZRJm7SZ7ejhsvSFnls0UVvSplXRmek%2FuTmAv3KsRhUpSgTBRccDnLKjbJEnubp6HtI0UPYyRQvhNdA0u587JwW5mn6a3X47K4yjpSQg0rt37Rgnh7SNKQIv3Ofywk8bAVBvdHlVLtZahaik5Fnh%2Fh3jJo1bSvuZfWS9YQwJroqyhnsTsgGXwyJYrq5gJah%2F%2Bs6t0gjdfvLJb1Qd0e8UmC3IGW%2B9%2F1IPPwJbWDxt5Mg5y4RLv0OIsSQ2BHgeCt6RoOlt3UYTzLEGfc%2FlpZZlHZgSHnPfn98Qo5ON4kQJbGR9mjPcoBReWgIyFl709IvfdY90cyxckqpxsaQeOzMjrwxFIPJw%2BTm7BUjSZke8FZ%2BJOstaAWjDIVfVb1VV4ZTgDD%2F88%2FQBjqZAaAg1jAjzQ%2FwaTSZGnUi1Y6A2ukrWmW0nerO%2FB7%2F6DY9aIB%2FvKIei6Pwj6EGJUTmfsfuek%2BTegZdzaGCNaEG%2B8CLB8G8U3tBIgyuZ%2FqCF5fdEM051RfUecqmiF0Bc2Gy5tALKAAwaWzk%2FTss3jWG%2Bb8Bwq9O5Yrwv0YgtpyIDSG5dyq3f9G1qyfEw018mOf686rMLi3p6MnPyQ%3D%3D&Expires=1779696042>
