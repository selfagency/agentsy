# Phase 7 — Memory Integration (with AgentFS Migration)

**Effort:** ~20 hours  
**Milestone:** Live memory capture/retrieval in CLI; AgentFS Phase 8a/8b/8c migration  
**Packages:** `@agentsy/memory`, `@agentsy/runtime`, `@agentsy/core`  
**Gate:** Memory layer fully integrated; optional Turso migration staged  
**Next:** Phase 8  

---

## Overview

Integrate memory capture/retrieval hooks into runtime. Implement fact extraction. Optionally migrate to AgentFS schema (Phase 8a/8b/8c, deferred).

**Foundation:** Memory layer production-ready from Phase 0 (98% complete).

---

## TASK-031: Memory Capture Hooks

**Location:** `packages/runtime/src/hooks/`

```typescript
// memory-post-turn.ts
export function createMemoryPostTurnHook(memory: MemoryEngine) {
  return {
    name: 'memory:post-turn',
    event: 'post-turn',
    priority: 100,
    handler: async (ctx) => {
      const observations = extractObservations(ctx.lastTurn, {
        minConfidence: 0.7,
        types: ['user_preference', 'entity', 'procedure', 'constraint']
      });

      for (const obs of observations) {
        await memory.capture({
          sessionId: ctx.sessionId,
          type: obs.type,
          content: obs.content,
          sourceMessageId: ctx.lastMessageId,
          timestamp: new Date()
        });
      }

      return ctx;
    }
  };
}

// memory-pre-turn.ts
export function createMemoryPreTurnHook(memory: MemoryEngine) {
  return {
    name: 'memory:pre-turn',
    event: 'pre-turn',
    priority: 100,
    handler: async (ctx) => {
      const relevant = await memory.retrieveMultiTier({
        sessionId: ctx.sessionId,
        query: ctx.userMessage,
        limit: 10,
        minRelevance: 0.6
      });

      ctx.memoryContext = formatMemorySegments(relevant);
      return ctx;
    }
  };
}

// wiki-memory.ts
export function createWikiMemoryHook(memory: MemoryEngine) {
  return {
    name: 'memory:wiki-synthesis',
    event: 'post-turn',
    priority: 50,
    enabled: true,
    handler: async (ctx) => {
      // Trigger wiki synthesis every N turns or on relevance change
      if (ctx.stepCount % 10 === 0 || ctx.relevanceShift > 0.3) {
        await memory.wiki.synthesize({
          sessionId: ctx.sessionId,
          scope: 'session'
        });
      }

      return ctx;
    }
  };
}
```

---

## TASK-032: Fact Extraction & Memory-as-Tool

### Fact Extraction

```typescript
// packages/memory/src/extraction/index.ts
export interface ExtractedFact {
  type: 'user_preference' | 'entity' | 'procedure' | 'constraint' | 'task_context';
  content: string;
  confidence: number;
  sourceMessageId: string;
  embedding?: number[];
  expiresAt?: Date;
}

export class FactExtractor {
  async extract(turn: Turn, model: LLMClient): Promise<ExtractedFact[]> {
    const prompt = `Extract facts from this conversation turn.

Categories:
- user_preference: What the user likes/wants
- entity: Named objects/people/places
- procedure: How to do something
- constraint: Limitations/restrictions
- task_context: Current work context

Turn:
${turn.content}

Return JSON array of { type, content, confidence (0-1) }.`;

    const response = await model.complete({
      messages: [{ role: 'user', content: prompt }],
      schema: { type: 'array', items: { ... } }
    });

    return JSON.parse(response.text);
  }
}
```

### Memory-as-Tool

Register in default tool registry:

```typescript
{
  name: 'memory_append',
  description: 'Store fact/preference/observation',
  inputSchema: {
    type: 'object',
    properties: {
      type: { enum: ['user_preference', 'entity', 'procedure', 'constraint'] },
      content: { type: 'string' },
      expiresAtDays: { type: 'number', optional: true }
    },
    required: ['type', 'content']
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  },
  handler: async (input, ctx) => {
    await ctx.memory.capture({
      sessionId: ctx.sessionId,
      type: input.type,
      content: input.content,
      expiresAt: input.expiresAtDays ? 
        new Date(Date.now() + input.expiresAtDays * 86400000) : 
        undefined
    });
    return { success: true };
  }
},

{
  name: 'memory_search',
  description: 'Search long-term memory',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number', optional: true }
    },
    required: ['query']
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  handler: async (input, ctx) => {
    const results = await ctx.memory.queryUnified({
      sessionId: ctx.sessionId,
      query: input.query,
      limit: input.limit || 5,
      minRelevance: 0.5
    });

    return { results };
  }
}
```

---

## TASK-033..036: CLI Integration + Commands

```bash
agentsy memory search <query>     # Search all tiers
agentsy memory list               # All memories
agentsy memory stats              # Usage report
agentsy memory lint               # Quality check

# Interactive
/memory search \"how do I deploy\"
/memory stats
```

---

## TASK-034: Cache-Aware Context Reuse

**Location:** `packages/core/src/` + `packages/runtime/src/`

```typescript
// Reuse context from previous turns if fingerprint matches
export interface ContextFingerprint {
  modelId: string;
  messageCount: number;
  lastMemoryRefresh: Date;
  hash: string; // SHA-256 of context content
}

export function computeContextFingerprint(ctx: AgentLoopContext): ContextFingerprint {
  return {
    modelId: ctx.model,
    messageCount: ctx.messages.length,
    lastMemoryRefresh: ctx.lastMemoryRefresh,
    hash: sha256(serializeContext(ctx))
  };
}

// On resume: compare fingerprints
export async function reuseContextIfValid(
  snapshot: SessionSnapshot,
  newContext: AgentLoopContext
): Promise<AgentLoopContext> {
  if (snapshot.cacheFingerprint?.hash === computeContextFingerprint(newContext).hash) {
    // Reuse cached context (reduces re-encoding tokens)
    return snapshot.context;
  }

  return newContext;
}
```

---

## Phase 8a/8b/8c: AgentFS Migration (Optional, Deferred)

### Phase 5 ✅: Unified Query Interface

Already complete: `queryUnified(query, { limit, minRelevance })` returns combined results.

### Phase 6 (Deferred to Phase 8a): MCP Tools for Wiki + RAG

Create MCP tools wrapping memory layer:

```typescript
// Phase 8a deliverable
{
  name: 'memory_wiki_query',
  description: 'Query wiki for concepts',
  handler: async (input) => {
    // Calls memory.wiki.query()
  }
},

{
  name: 'memory_rag_search',
  description: 'Search RAG sources',
  handler: async (input) => {
    // Calls memory.retrieval.search()
  }
}
```

### Phase 7 (Deferred to Phase 8b): Unified Initialization

```typescript
// Phase 8b: initMemory() with all layers
export async function initMemory(config: MemoryConfig): Promise<MemoryEngine> {
  return new MemoryEngine({
    tiers: initTiers(config),
    wiki: initWiki(config),
    rag: initRag(config),
    coordination: initCoordination(config),
    sync: initSync(config)
  });
}
```

### Phase 8c (Deferred): AgentFS Schema Migration

See `11-PHASE-8-RAG-AUGMENTATION.md` for full migration plan.

**For Phase 7:** Keep in-memory AgentFS store (`packages/memory/src/filesystem/internal-store/`). Turso migration is optional optimization.

---

## Quality Gates

- ✅ Memory hooks fire in correct order (pre/post turn)
- ✅ Fact extraction working
- ✅ Memory-as-tool registered + functional
- ✅ CLI commands working
- ✅ Cache fingerprint validated
- ✅ All tests pass

---

**Next phase:** `11-PHASE-8-RAG-AUGMENTATION.md`
