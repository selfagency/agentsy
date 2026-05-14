# Multi-Tiered Memory Package Strategy Synthesis

## Executive Summary

This document synthesizes the best strategies from 12 source materials into a unified multi-tiered memory architecture that combines:

- Human cognitive models (sensory → sensory → working → short-term → long-term)
- Modern RAG architectures (event logs → synthesized wiki → vector index)
- Production-grade agent memory systems (OB1 general-agentic-memory, memelord, Turso, honker, remindb)

---

## Core Architecture: 5-Tier Memory System

### Tier 1: Sensory Memory Buffer (_duration: 1-5 seconds_)

- Stream of raw events from the environment
- Token-efficient limited buffer (100-200 tokens)
- Ultra-fast writes, single-pass read
- `_cache_and_route()` function forwards data
- Minimal retention, primarily for event routing

### Tier 2: Sensory Register (duration: 0.5-2 seconds)

- Ultra-short-term holding buffer
- Concurrent multiple sensory modalities
- 3-4 items max (parallel voice/print processing)
- Token aggregation across channels
- Threshold-based persistence to Working Memory

### Tier 3: Working Memory (duration: 18-30 seconds)

- "Here and Now" active processing space
- 4-7 chunks of information (Cowan's capacity model)
- Dual-task support (parallel voice + print)
- Compresses incoming events into "chunks"
- Short-term data selection and processing

### Tier 4: Short-Term Memory (duration: minutes to hours)

- Temporary storage of compressed chunks
- Limited retention before consolidation
- \_ awaken() function scans for sleep mode and time decay
- Action generation and metadata extraction
- Multi-projection window (6-12 active memories)

### Tier 5: Long-Term Memory (duration: indefinite)

- ConsolidatedSemantic stored events in structured format
- Write heaps: EVENT (raw), QUERY (index), DOC (synthesis), REF (link)
- Four memory types:
  - SEMANTIC: Language-based facts, done via embedding similarity
  - EPISODIC: Autobiographical events, composed from recent experience
  - PROCEDURAL: Agent capabilities, model specs, platform infrastructure
  - SENSORY: Visual/audio embedding-supported data
- Multi-filter retrieval: time, importance, similarity,omputation of token budget
- Interactive consolidation: responsiveness to user queries

---

## Research-Backed Design Principles

### Token Efficiency Strategies (honker inspiration)

1. Output: 75% token reduction via `Man talked to all his friends.`
2. Memory: 46% token reduction via repeated observation filtering
3. Coordinate liveness (multi-stage liveness) across agents

### Memory Liveness (Turso inspiration)

- Stage 1: Collect from live stream (simple pull)
- Stage 2: Parse structure and types (syntactic transformations)
- Stage 3: Apply business logic and deduplication (semantic consolidation)
- Continuous refresh to keep before/after queries deterministic

### Event-First Architecture (memelord inspiration)

- Raw event log as single source of truth
- Read-heavy cluster (primary, replica, caching)
- Write-heavy cluster (partitioned ingestion)
- Synthesized wiki writes to memory store
- Latency-minimized memory writes

### Hierarchical Processing (OB1 & honker inspiration)

- Compressors transform raw → working → short-term
- Synthesizers working → short-term
- Summarizers short-term → long-term
- Bridges manage inter-tier communication
- Each tier optimized for time window and operations

### Retrieval-Enhanced Generation (remindb & general-agentic-memory inspiration)

- Async memory writes & retrieval
- Vector similarity search for semantic relevance
- Time-based recency retrieval
- Importance filtering (manual ex-ante + automatic)
- Query-first approach for prioritizing needs

---

## Implementation Requirements

### Core Components

1. **Memory Interface**: unified API for read/write across tiers
2. **Tier Managers**: Sensory, Sensory Register, Working, Short-Term, Long-Term
3. **Bridges**: Inter-tier communication logic
4. **Processors**: Compressors, Synthesizers, Summarizers
5. **Persistence Layer**: Storage backend with write heaps
6. **Indexing Layer**: Vector embeddings and structured indexes

### Data Structures

```
Event: { timestamp, type, content, source, metadata }
Chunk: { id, content, tokens, importance, expiration }
Memory: { id, content, type, tier importance, timestamps, references }
Bridge: { sourceTier, destinationTier, transferLogic, priority }
```

### Time-Based Lifecycle

- Sensory: 1-5 seconds → discard or forward
- Sensory Register: 0.5-2 seconds → aggregate or discard
- Working: 18-30 seconds → compress or consolidate
- Short-Term: minutes-hours → summarize or decay
- Long-Term: indefinite → retain + archive

---

## Performance Targets

### Operation Latency (per tier)

- Write: <1ms (Sensory), <5ms (Sensory Register), <10ms (Working)
- Read: <1ms (Sensory), <2ms (Sensory Register), <5ms (Working)
- Consolidation: <50ms tier to tier, <200ms complete consolidation

### Memory Constraints

- Sensory Buffer: 100-200 tokens max
- Sensory Register: 3-4 concurrent items
- Working Memory: 4-7 chunks max
- Short-Term: Limited by token budget importance scores
- Long-Term: Unlimited, with archival tier

### Token Efficiency

- 75% reduction in output tokens
- 46% reduction in memory tokens
- Repeated observation filtering
- Multi-projection culling

---

## Integration with Existing Systems

### Honker Coordination

- Multi-stage liveness coordination
- Token budget negotiation
- Priority-based routing
- Cross-agent memory sharing

### Token Budget System

- Importance-based allocation
- Tier-specific quotas
- Dynamic recalculation on write
- Compression feedback loops

### Agent Lifecycle

- Initialization: load Long-Term, reset working tiers
- Session Manager: monitor tier capacities, trigger consolidation
- Shutdown: async consolidate Short-Term to Long-Term

---

## Next Implementation Phases

### Phase 1: Core Tier Structure (Estimated: 2-3 days)

- Implement 5-tier memory interface
- Build tier managers with time-based lifecycle
- Create persistence and indexing layers
- Establish communication protocol

### Phase 2: Processing Pipeline (Estimated: 2-3 days)

- Implement compressors, synthesizers, summarizers
- Build inter-tier bridges
- Create event routing logic
- Integrate importance scoring

### Phase 3: Integrations (Estimated: 2 days)

- Connect to honker coordination
- Implement token budget management
- Add agent lifecycle hooks
- Build monitoring and debugging tools

### Phase 4: Optimization (Estimated: 2 days)

- Performance testing and tuning
- Token efficiency validation
- Stress testing under load
- Memory leak detection

---

## Testing Strategy

### Unit Tests

- Tier lifecycle management
- Inter-tier communication
- Token budget compliance
- Importance scoring algorithms
- Embedding generation and similarity

### Integration Tests

- End-to-end memory flows
- Multi-agent coordination
- Persistence layer reliability
- Recovery from failures

### Performance Tests

- Latency benchmarks per tier
- Throughput under load
- Memory usage analysis
- Token reduction validation

---

## Success Metrics

- 75% output token reduction
- 46% memory token reduction
- <200ms consolidation latency
- Zero memory leaks
- Multi-agent coordination success rate >95%
