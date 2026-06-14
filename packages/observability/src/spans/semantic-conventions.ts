/**
 * Semantic Conventions for Agentsy spans.
 *
 * Defines canonical span names and attribute keys so all packages
 * emit consistent telemetry. Follows OpenTelemetry semantic convention
 * naming: lowercase, dot-separated, no hyphens.
 *
 * @module @agentsy/observability/spans
 */

// ---------------------------------------------------------------------------
// Span names
// ---------------------------------------------------------------------------

export const SpanNames = {
  // Agent loop
  AGENT_RUN: 'agent.run',
  AGENT_STEP: 'agent.step',

  // LLM
  LLM_CALL: 'llm.call',
  LLM_STREAMING: 'llm.streaming',

  // Tools
  TOOL_CALL: 'tool.call',
  TOOL_EXECUTION: 'tool.execution',

  // Retrieval
  RETRIEVAL_QUERY: 'retrieval.query',
  RETRIEVAL_RERANK: 'retrieval.rerank',

  // Memory
  MEMORY_COMPACT: 'memory.compact',
  MEMORY_RETRIEVE: 'memory.retrieve',

  // Runtime
  HOOK_FIRE: 'hook.fire',
  PLUGIN_LOAD: 'plugin.load',
  CONTEXT_INJECT: 'context.inject'
} as const;

// ---------------------------------------------------------------------------
// Semantic attribute keys
// ---------------------------------------------------------------------------

export const SemanticAttributes = {
  llm: {
    model: 'llm.model',
    provider: 'llm.provider',
    inputTokens: 'llm.input_tokens',
    outputTokens: 'llm.output_tokens',
    latencyMs: 'llm.latency_ms',
    costUsd: 'llm.cost_usd',
    finishReason: 'llm.finish_reason',
    requestId: 'llm.request_id'
  },

  tool: {
    name: 'tool.name',
    argsHash: 'tool.args_hash',
    resultContentHash: 'tool.result_content_hash',
    latencyMs: 'tool.latency_ms',
    isCached: 'tool.is_cached'
  },

  retrieval: {
    queryClass: 'retrieval.query_class',
    sparseHits: 'retrieval.sparse_hits',
    denseHits: 'retrieval.dense_hits',
    rerankScore: 'retrieval.rerank_score',
    citationCount: 'retrieval.citation_count'
  },

  memory: {
    tier: 'memory.tier',
    operation: 'memory.operation',
    durationMs: 'memory.duration_ms',
    bytesRead: 'memory.bytes_read',
    bytesWritten: 'memory.bytes_written'
  }
} as const;
