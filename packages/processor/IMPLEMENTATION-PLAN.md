# IMPLEMENTATION-PLAN.md

## Package: @agentsy/processor

### Overview
Core LLM stream processing engine handling universal chunk parsing, state management, and response transformation. Provides the foundational stream processing substrate that all other packages build upon. Note: Provider-specific parsers are being moved to the providers package.

### Current Status
✅ **Live** - Core stream processing implementation exists

### Core Responsibilities
- LLM stream chunk parsing
- Stream state management
- Response transformation and formatting
- Error recovery and resilience
- Stream performance optimization

### Public API Design
```typescript
// Stream processor interface
export interface StreamProcessor {
  // Core processing
  process(chunk: StreamChunk): ProcessResult
  processStream(stream: AsyncIterable<StreamChunk>): AsyncIterable<ProcessResult>
  
  // State management
  getState(): StreamState
  resetState(): void
  
  // Configuration
  configure(options: ProcessorOptions): void
  getConfiguration(): ProcessorOptions
}

// Stream chunks
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'thinking' | 'error' | 'metadata'
  content: string | Object
  metadata: Record<string, unknown>
  timestamp: Date
  index: number
}

// Process result
export interface ProcessResult {
  type: 'content' | 'state_change' | 'tool_call' | 'thinking' | 'error'
  data: unknown
  state: StreamState
  metadata?: Record<string, unknown>
}

// Stream state
export interface StreamState {
  sessionId: string
  phase: 'preamble' | 'content' | 'tool_calls' | 'thinking' | 'postamble' | 'complete' | 'error'
  accumulated: {
    text: string
    toolCalls: ToolCall[]
    thinking: string
    metadata: Record<string, unknown>
  }
  timing: {
    started: Date
    lastChunk: Date
    duration?: Duration
  }
  statistics: {
    totalChunks: number
    chunksByType: Record<string, number>
    averageChunkSize: number
  }
}

// Processor factory
export class StreamProcessorFactory {
  createProcessor(config: ProcessorConfig): StreamProcessor
  createParser(provider: string, model: string): StreamParser
  createStateTracker(sessionId: string): StateTracker
}

// Processor with built-in recovery
export class ResilientStreamProcessor implements StreamProcessor {
  constructor(baseProcessor: StreamProcessor, options: ResilientOptions)
  
  // Enhanced processing with recovery
  processStream(stream: AsyncIterable<StreamChunk>): AsyncIterable<ProcessResult>
  
  // Recovery methods
  recoverFromError(error: ProcessingError): Promise<RecoveryResult>
  getRecoveryHistory(): RecoveryRecord[]
}
```

### Implementation Strategy

#### Universal Chunk Processing
- **Provider-specific parsers moved to providers package**
- Universal chunk representation only
- Parser registry for provider detection
- Chunk normalization and validation
- Focus on processing logic, not parsing logic

#### State Management
- Immutable state updates
- Efficient state diffing
- State persistence capabilities
- Rollback and recovery

#### Performance Optimization
- Streaming without buffering where possible
- Efficient chunk parsing
- Memory usage optimization
- Parallel processing where safe

#### Error Recovery
- Graceful degradation on malformed chunks
- Automatic retry mechanisms
- State checkpointing
- Error categorization and handling

### Dependencies
- Internal: `@agentsy/types` - Core interfaces
- Internal: `@agentsy/context` - Context window management
- Internal: `@agentsy/xml-filter` - Privacy filtering
- External: Parsing libraries for various formats

### Test Strategy
- Provider-specific chunk format tests
- State management validation
- Error recovery scenarios
- Performance benchmarks
- Edge case handling

### Co-development Dependencies
- `recovery` - Advanced recovery mechanisms
- `thinking` - Thinking block parsing
- `tool-calls` - Tool call extraction
- `context` - Context window integration

### Source Plan References
- `plan/agentsy-tech.md` §3.1 - Stream processing architecture
- `plan/agentsy-recovery.md` - Error recovery patterns
- `plan/agentsy-thinking.md` - Thinking block processing

### Implementation Status

#### Current Features (✅ Complete)
- [x] Basic StreamProcessor interface
- [x] OpenAI chunk parsing
- [x] Stream state tracking
- [x] Error handling basics
- [x] Provider factory
- [x] Performance optimization

#### Next Phase Additions
- [ ] Anthropic chunk parsing
- [ ] Universal chunk normalization
- [ ] Advanced state persistence
- [ ] Parallel processing support
- [ ] Enhanced recovery mechanisms

### Implementation Milestones

#### Phase 1: Universal Processing
- [ ] Provider-agnostic chunk interface  
- [ ] Parser registry integration
- [ ] Generic format detection
- [ ] Chunk validation framework
- [ ] Unified error handling
- [ ] Provider parsers moved to providers package

#### Phase 2: Performance & Scaling
- [ ] Memory-efficient streaming
- [ ] Backpressure handling
- [ ] Chunk prioritization
- [ ] Concurrent processing
- [ ] Resource usage monitoring

#### Phase 3: Advanced Features
- [ ] State persistence integration
- [ ] Predictive parsing
- [ ] Adaptive performance
- [ ] Advanced diagnostics
- [ ] Custom parser registration

#### Phase 4: Integration Enhancements
- [ ] Deep integration with recovery
- [ ] Thinking block optimization
- [ ] Tool call extraction improvements  
- [ ] Context window management
- [ ] Universal optimization (剔除provider-specific)
- [ ] Provider integration via registry

### File Structure (Universal Only)
```
packages/processor/src/
├── index.ts                    # Public exports
├── core/
│   ├── processor.ts           # StreamProcessor interface
│   ├── chunk.ts               # StreamChunk definitions
│   ├── state.ts               # StreamState management
│   └── result.ts              # ProcessResult types
├── universal/
│   ├── parser.ts              # Universal parsing logic
│   ├── detector.ts            # Provider detection
│   ├── registry.ts            # Parser registry
│   └── factory.ts             # Universal factory
├── state/
│   ├── tracker.ts             # State tracking
│   ├── persistence.ts         # State serialization
│   └── diff.ts                # State diffing
├── recovery/
│   ├── resilient.ts           # ResilientStreamProcessor
│   ├── recovery.ts            # Recovery mechanisms
│   └── history.ts             # Recovery tracking
├── performance/
│   ├── optimization.ts        # Performance optimization
│   ├── backpressure.ts        # Backpressure handling
│   └── monitoring.ts          # Performance monitoring
├── integration/
│   ├── providers.ts           # Provider integration APIs
│   ├── callbacks.ts           # Processing callbacks
│   └── extensions.ts          # Extension points
└── factory/
    ├── processor-factory.ts   # ProcessorFactory
    └── config.ts              # Configuration management
```

### Verification Criteria
- [ ] All provider chunk formats parse correctly
- [ ] State management is accurate and efficient
- [ ] Performance meets requirements (<1ms per chunk average)
- [ ] Memory usage stays within limits
- [ ] Error recovery works in all scenarios
- [ ] Integration with dependent packages seamless

### Risk Register
- **Medium**: Provider chunk format changes breaking compatibility
- **Medium**: Performance regression with added features
- **Low**: State management complexity and bugs
- **Low**: Memory leaks in long-running streams

### Future Considerations
- Real-time performance optimization
- Additional provider support (Gemini, Claude 3.5+)
- Streaming compression for large responses
- Advanced predictive parsing
- Custom DSL support within streams