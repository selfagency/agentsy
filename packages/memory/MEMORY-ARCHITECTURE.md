# Memory Package Architecture Design

## Overview

This document provides the complete architecture for the 5-tier memory system that combines human cognitive models with modern RAG architectures and production-grade agent memory systems.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Environment                          │
│  (Events, User Input, Tool Output, System Messages)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Tier 1: Sensory Memory Buffer│
        │  Duration: 1-5 seconds        │
        │  Size: 100-200 tokens         │
        └────────────┬─────────────────┘
                     │
    ┌────────────────┴────────────────┐
    │                                 │
    ▼                                 ▼
┌───────────────┐            ┌──────────────────┐
│ Multi-channel │            │  cache_and_route  │
│ event stream  │            │   function       │
└───────────────┘            │ (forward data)   │
                             └────────┬─────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │ Tier 2: Sensory Register │
                           │ Duration: 0.5-2 seconds │
                           │ Capacity: 3-4 items      │
                           └──────────┬───────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │  Threshold checking   │
                           │  (aggregate/persist)  │
                           └──────────┬───────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │ Tier 3: Working Memory │
                           │ Duration: 18-30 seconds │
                           │ Capacity: 4-7 chunks     │
                           └──────────┬───────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
          ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
          │ Compressor     │  │ Synthesizer  │  │ Bridge       │
          │ (raw-working   │  │ (working→ST) │  │ (communication│
          │ create chunks) │  │              │  │ logic)       │
          └────────────────┘  └──────────────┘  └──────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │ Tier 4: Short-Term Memory │
                           │ Duration: minutes-hours    │
                           │ Multi-projection: 6-12     │
                           └──────────┬───────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
          ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
          │ Summarizer     │  │ awaken()     │  │ MetaAction   │
          │ (ST→LT)        │  │ (scan sleep/ │  │ Generator    │
          │                │  │ time decay)  │  │              │
          └────────────────┘  └──────────────┘  └──────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │ Tier 5: Long-Term Memory │
                           │ Duration: indefinite        │
                           │ Write Heaps: 4 types         │
                           └──────────┬───────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │                      │                      │
               ▼                      ▼                      ▼
     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
     │ EVENT Heap      │     │ QUERY Heap      │     │ DOC Heap        │
     │ (raw events)    │     │ (index info)    │     │ (synthesis)     │
     └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                               │
                                        ┌──────────────────────┼──────────────────────┐
                                        │                      │                      │
                                        ▼                      ▼                      ▼
                               ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                               │ REF Heap        │     │ Archival Tier  │     │ 4 Memory Types  │
                               │ (links/meta)    │     │ (historical)    │     │ SEMANTIC,EPISODE│
                               └─────────────────┘     └─────────────────┘     │ PROCEDURAL,SENS │
                                                                                   └─────────────────┘
```

---

## Detailed Component Specifications

### 1. Sensory Memory Buffer (Tier 1)

**Purpose**: Initial event capture and routing
**Time Window**: 1-5 seconds
**Capacity**: 100-200 tokens
**Characteristics**:

- Ultra-fast writes (<1ms)
- Single-pass reads
- Routes events to appropriate channels
- Minimal retention

**Public Interface**:

```typescript
interface SensoryBuffer {
  write(event: Event): void;
  read(): Event[];
  flush(): void;
}
```

**Data Flow**:

- Input: Raw events from environment
- Process: `cache_and_route()` analysis
- Output: Forwarded to Sensory Register

---

### 2. Sensory Register (Tier 2)

**Purpose**: Multi-modal concurrent processing
**Time Window**: 0.5-2 seconds
**Capacity**: 3-4 concurrent items
**Characteristics**:

- Handles multiple sensory modalities
- Parallel processing (voice + print)
- Aggregates related events
- Threshold-based persistence

**Public Interface**:

```typescript
interface SensoryRegister {
  register(modality: Modality, data: unknown): void;
  aggregate(): Chunk[];
  checkThresholds(): boolean;
}
```

**Data Flow**:

- Input: Routed data from Sensory Buffer
- Process: Multi-modal aggregation
- Output: Chunks for Working Memory

---

### 3. Working Memory (Tier 3)

**Purpose**: Active processing space
**Time Window**: 18-30 seconds
**Capacity**: 4-7 chunks (Cowan's capacity model)
**Characteristics**:

- "Here and Now" consciousness
- Dual-task support
- Chunk creation and management
- Compresses incoming events

**Public Interface**:

```typescript
interface WorkingMemory {
  addChunk(chunk: Chunk): void;
  getChunks(maxK: number): Chunk[];
  compress(): void;
  isActive(): boolean;
}
```

**Data Flow**:

- Input: Aggregate chunks from Sensory Register
- Process: Compressors and Synthesizers
- Output: Compressed data for Short-Term Memory

---

### 4. Short-Term Memory (Tier 4)

**Purpose**: Temporary storage before consolidation
**Time Window**: minutes to hours
**Capacity**: Multi-projection (6-12 active memories)
**Characteristics**:

- Time decay management
- Action generation
- Metadata extraction
- Query-last consolidation

**Public Interface**:

```typescript
interface ShortTermMemory {
  store(memory: Memory): void;
  retrieve(query: Query): Memory[];
  awaken(): void; // Scan for sleep mode and time decay
  consolidate(): void;
}
```

**Data Flow**:

- Input: Compressed chunks and metadata
- Process: Summarizers and awaken() scans
- Output: Consolidated memories for Long-Term

---

### 5. Long-Term Memory (Tier 5)

**Purpose**: Consolidated, permanent storage
**Time Window**: indefinite
**Capacity**: Unlimited with archival
**Characteristics**:

- Four memory types (SEMANTIC, EPISODIC, PROCEDURAL, SENSORY)
- Four write heaps (EVENT, QUERY, DOC, REF)
- Multi-filter retrieval
- Interactive consolidation

**Public Interface**:

```typescript
interface LongTermMemory {
  write(heap: WriteHeap, data: unknown): void;
  search(filters: FilterSet): Memory[];
  consolidate(): void;
  archive(cutoff: Date): void;
}
```

**Write Heaps**:

- **EVENT**: Raw event data
- **QUERY**: Index and query information
- **DOC**: Synthesized documents
- **REF**: Links, references, metadata

**Data Flow**:

- Input: Consolidated memories from Short-Term
- Process: Heap organization and indexing
- Output: Searchable long-term storage

---

## Inter-Tier Communication (Bridges)

### Bridge Architecture

```
          ┌─────────────────────────────────────────┐
          │            Bridge System                │
          │                                         │
          │  ┌──────────────┐  ┌──────────────┐     │
          │  │ Bridge 1-2   │  │ Bridge 2-3   │     │
          │  │ Sensory→     │  │ Sensory Reg→│     │
          │  │ Sensory Reg  │  │ Working      │     │
          │  └──────────────┘  └──────────────┘     │
          │                                         │
          │  ┌──────────────┐  ┌──────────────┐     │
          │  │ Bridge 3-4   │  │ Bridge 4-5   │     │
          │  │ Working→ST   │  │ ST→LT        │     │
          │  └──────────────┘  └──────────────┘     │
          └─────────────────────────────────────────┘
```

### Bridge Logic

Each bridge contains:

- Transfer protocol
- Priority routing
- Time-based triggers
- Token budget checks
- Failure handling

---

## Processing Pipeline

### Compression Pipeline

```
Raw Events → Chunking → Compression → Working Memory
```

### Synthesis Pipeline

```
Working Memory → Synthesis → Short-Term Memory
```

### Summarization Pipeline

```
Short-Term Memory → Summarization → Long-Term Memory
```

---

## Integration Points

### Honker Coordination

```typescript
interface HonkerIntegration {
  negotiateTokenBudget(): Budget;
  coordinateLiveness(): LivenessStatus;
  shareMemory(agentId: string, memory: Memory): void;
}
```

### Token Budget System

```typescript
interface TokenBudgetSystem {
  allocate(tier: MemoryTier, tokens: number): boolean;
  reclaim(tier: MemoryTier): number;
  recomputeBudget(): void;
}
```

### Agent Lifecycle

```typescript
interface AgentLifecycle {
  initialize(): void;
  onSessionStart(): void;
  onSessionEnd(): void;
  shutdown(): void;
}
```

---

## Performance Flow Diagram

```
Event Input → Sensory Buffer (1ms) → Sensory Register (2ms) →
Working Memory (5ms) → Short-Term (10ms) → Long-Term (50ms) →
Complete Consolidation (200ms max)
```

---

## Memory Access Patterns

### Write Pattern

```
1. Sensory: fast, single-pass
2. Sensory Register: concurrent, multi-modal
3. Working: chunk-based, compressed
4. Short-Term: metadata-rich, time-aware
5. Long-Term: optimized for retrieval, indexed
```

### Read Pattern

```
1. Query generation
2. Multi-filter application
3. Tier-specific retrieval
4. Assembly acrossbridges
5. Consolidated response
```

---

## Testing Integration Points

### Unit Test Integration

- Tier lifecycle testing
- Bridge communication testing
- Token budget compliance testing

### Integration Test Integration

- End-to-end memory flow testing
- Multi-agent coordination testing
- Persistence layer testing

### Performance Test Integration

- Latency benchmark integration
- Throughput monitoring integration
- Memory leak detection integration
