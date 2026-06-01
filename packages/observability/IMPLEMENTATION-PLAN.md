---
goal: @agentsy/observability production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: observability-maintainers
status: In progress
tags: [feature, architecture, observability, tracing, metrics]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/observability` as the cross-package tracing, metrics, logging, and replay substrate.

It should adapt the strongest OpenLLMetry-style patterns in a way that fits Agentsy's architecture:

- **OpenTelemetry-first core** with semantic conventions for agent/model/tool events.
- **tslog-backed universal logger layer** for cross-domain structured logs (CLI/runtime/orchestrator/providers/tools/memory/UI adapters).
- **Redaction-first processing** so sensitive fields are scrubbed before any sink/export.
- **Composable destination adapters** rather than a monolithic backend.
- **Convenience SDK/bootstrap path** for quick local setup, plus direct instrumentation for already-instrumented callers.
- **Framework and provider instrumentation modules** for runtime, tools, memory, retrieval, providers, orchestrator, CLI, and VS Code surfaces.
- **Replay-friendly artifacts** that support deterministic debugging without storing raw secrets.

## 1. Requirements & Constraints

- **REQ-OBS-001**: Trace schema covers model, tool, approval, memory, retrieval, runtime, and orchestration events with stable semantic conventions.
- **REQ-OBS-002**: Span/event payload contracts are stable and versioned for downstream tooling and external OTEL sinks.
- **REQ-OBS-003**: Token/cost/latency telemetry integrates with `@agentsy/tokens` and operator surfaces.
- **REQ-OBS-004**: Export paths support local logs, console/file sinks, and OTEL-compatible destinations.
- **REQ-OBS-005**: The package exposes a lightweight bootstrap path (e.g. `createObservabilityEngine`/`getDefaultEngine`) plus direct composition for already-instrumented consumers.
- **REQ-OBS-006**: Replay/debug artifacts preserve content-addressable linkage between traces, session snapshots, and incident review workflows.
- **REQ-OBS-007**: Logging APIs expose a universal typed logger factory backed by `tslog` with sub-loggers, correlation metadata propagation, and consistent JSON log object shape across domains.
- **SEC-OBS-001**: Redaction pipeline runs before persistence/export, at the span processor or sink boundary.
- **SEC-OBS-002**: Retention defaults minimize sensitive-data exposure.
- **SEC-OBS-003**: Telemetry collection is optional and anonymous; direct instrumentation should not require data collection.
- **CON-OBS-001**: Observability records behavior; policy enforcement remains in guardrails/runtime.
- **CON-OBS-002**: Trace contracts remain surface-agnostic (CLI/VS Code/web).
- **CON-OBS-003**: Structured logging contracts are centralized in `@agentsy/observability`; production packages should not rely on raw `console.*` calls for operational logging.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-OBS-001: Contract stabilization on an OpenTelemetry semantic-convention baseline.

| Task         | Description                                                                                                                                                               | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-OBS-001 | Stabilize trace/span/event contracts and semantic field taxonomy.                                                                                                         |           |      |
| TASK-OBS-002 | Add redaction contract tests and schema validation snapshots.                                                                                                             |           |      |
| TASK-OBS-003 | Document ownership boundaries and package integration points.                                                                                                             |           |      |
| TASK-OBS-013 | Define semantic conventions for AgentSpan, model calls, tool calls, retrieval, memory, session, and orchestration events so downstream dashboards get stable field names. |           |      |
| TASK-OBS-019 | Define universal logger contracts (base logger + sub-logger taxonomy, required correlation fields, and redaction/masking defaults) for a tslog-backed implementation.     |           |      |

### Implementation Phase 2

- GOAL-OBS-002: Core observability implementation with destination adapters and replay-friendly artifacts.

| Task         | Description                                                                                                                            | Completed | Date |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-OBS-004 | Implement trace assembly, correlation IDs, and exporter abstraction layers.                                                            |           |      |
| TASK-OBS-005 | Implement token/cost/latency metric aggregation and summaries.                                                                         |           |      |
| TASK-OBS-006 | Finalize redaction and safe export pipelines.                                                                                          |           |      |
| TASK-OBS-014 | Add first-class sink/adapters for console, file, OTLP-compatible export, and local debug capture.                                      |           |      |
| TASK-OBS-015 | Add replay-friendly record format (content-addressable trace/session artifacts) for deterministic debugging and incident review.       |           |      |
| TASK-OBS-020 | Implement tslog-backed logger engine and adapter bridge (pretty/json/hidden modes, attached transports, and child logger inheritance). |           |      |

### Implementation Phase 3

- GOAL-OBS-003: Cross-package and surface integration with instrumentation modules.

| Task         | Description                                                                                                                                                                            | Completed | Date |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-OBS-007 | Integrate runtime/orchestrator/tools/memory/providers telemetry emission.                                                                                                              |           |      |
| TASK-OBS-008 | Expose CLI/VS Code diagnostics and trace inspection workflows.                                                                                                                         |           |      |
| TASK-OBS-009 | Add integration tests for trace completeness and redaction guarantees.                                                                                                                 |           |      |
| TASK-OBS-016 | Add instrumentation modules or wrappers for framework surfaces (runtime, tools, memory, retrieval, providers, orchestrator, CLI, VS Code) using consistent semantic-convention naming. |           |      |
| TASK-OBS-017 | Make direct instrumentation usable without the convenience bootstrap path for already OTEL-instrumented deployments.                                                                   |           |      |
| TASK-OBS-021 | Integrate universal logger factories across runtime/tools/memory/retrieval/providers/orchestrator/CLI/VS Code with domain-specific sub-loggers and shared correlation IDs.             |           |      |

### Implementation Phase 4

- GOAL-OBS-004: Hardening and release readiness.

| Task         | Description                                                                                                                                  | Completed | Date |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-OBS-010 | Add performance and retention behavior regressions.                                                                                          |           |      |
| TASK-OBS-011 | Align package docs and incident-debugging examples.                                                                                          |           |      |
| TASK-OBS-012 | Pass package and monorepo release gates.                                                                                                     |           |      |
| TASK-OBS-018 | Validate no-telemetry defaults, anonymous-only collection boundaries, and sink redaction under load.                                         |           |      |
| TASK-OBS-022 | Add regression/performance tests for logger overhead, transport fan-out behavior, and redaction correctness under high-volume event streams. |           |      |

## 3. Acceptance Criteria

- **ACC-OBS-001**: Required event coverage and schema stability are validated.
- **ACC-OBS-002**: Redaction guarantees hold across all exporters.
- **ACC-OBS-003**: CI/release gates pass.
- **ACC-OBS-004**: Semantic conventions and replay-friendly artifacts support consistent downstream debugging across sessions and services.
- **ACC-OBS-005**: Universal tslog-backed logger contracts are validated across domains with consistent field schemas, correlation propagation, and redaction guarantees.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `https://github.com/traceloop/openllmetry`
- `https://tslog.js.org`
- `docs/packages/observability.md`
- `packages/observability/README.md`
- `packages/observability/IMPLEMENTATION-REVIEW.md`
- `packages/observability/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/observability — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/observability` is the **diagnostic backbone** of the framework. It provides a unified engine for monitoring agent behavior, cost, and performance across all packages. It allows developers to visualize complex multi-agent workflows, debug non-deterministic LLM failures, and track project-level budgets.

It is a cross-cutting concern, consumed by nearly every other package via tracing spans and event emission.

### Ecosystem Sketch

    [ VS Code / CLI Dashboards ]
             |
             v
    [ @agentsy/observability ] <--- Aggregation & Redaction
             ^
             |      +-----------------------+-----------------------+
             +------|                       |                       |
                    |                       |                       |
          [ @agentsy/runtime ]    [ @agentsy/core ]    [ @agentsy/memory ]
          (Execution Spans)      (Model Call Metrics)   (Retrieval Events)

## Fulfillment of Role

The package fulfills its role by implementing an OpenTelemetry-compatible observability stack:

1. **Standardized Tracing**: Captures the full lifecycle of an agent task, including subagent spawns and tool calls.
2. **AI-specific Metrics**: Tracks `token.input`, `token.output`, `cost.usd`, and `latency.ms` as first-class attributes.
3. **Privacy-safe Redaction**: Automatically scrubs PII and secrets before data hits any external sink.
4. **Recording & Playback**: Integrates with "Tapes" pattern for deterministic debugging of non-deterministic interactions.

### Recommended external integrations

Observability should stay composable rather than monolithic. The best-fit references are:

- **OpenTelemetry** as the baseline tracing and metrics substrate.
- **Tapes** for content-addressable session recording, replay, and deterministic debugging of agent interactions.
- **Opik** for higher-level LLM trace review, experiment tracking, and judge-style evaluation workflows.
- **Codeburn** for unique cost-yield analysis and deterministic optimization suggestions.

The package should expose a redaction-first span processor and sink boundary so those integrations can be used without leaking secrets or raw user content.

## Detailed Functionality

### 1. Tracing & Metrics (`src/tracing/`)

- **Agent Spans**: Specialized spans for `task`, `step`, `plan`, `action`, `synthesis`.
- **Graph Tracing**: Distributed tracing across supersteps in a workflow graph (LangGraph pattern).
- **Token Usage**: Tracking `inputTokens`, `outputTokens`, and `totalTokens` per step and aggregated per session.
- **Timing**: capturing `duration` for planning, action execution, and response generation phases.

### 2. Visualization & Replay (`src/visualization/`)

- **State Transition Visualization**: Tools to visualize the execution path through a `StateGraph`.
- **Branch Point Analysis**: identifying where workflows diverged or failed.
- **Agent Tree**: Tools to visualize the structure of managed agents and their relationships.
- **Step Replay**: Ability to replay agent execution from any checkpoint/snapshot.
- **Rich Logging**: structured, level-based logging (INFO, DEBUG, WARN, ERROR) with console/file sinks.

### 3. Metrics Engine (`src/metrics/`)

- **Responsibility**: Aggregating usage and performance data.
- **Functionality**:
  - `recordLatency`: Millisecond resolution of every operation.
  - `recordTokens`: Breakdown of input/output tokens per provider.
  - `recordCost`: Real-time USD estimates based on `@agentsy/tokens`.

### 4. Redaction & Safety (`src/privacy/`)

- **Responsibility**: Preventing credential leakage.
- **Mechanism**: Global regex-based scrubbers and provider-specific redaction rules (e.g., hiding message content in certain log levels).

### 4.1 Replay and audit notes

- Record enough metadata to reproduce a run without storing raw secrets in the event stream.
- Keep replay artifacts content-addressable so multiple tools can point at the same execution record.
- Preserve token and cost attribution at the span level so downstream dashboards can slice by model, session, or tool turn.

## Logic & Data Flow

### 1. Span Lifecycle

1. When `@agentsy/runtime` starts a step, it creates a new `AgentSpan`.
2. As the step progresses, sub-spans are created for model calls or tool executions.
3. Each span carries attributes like `agent.id`, `session.id`, and `workflow.node.id`.
4. Upon completion, the span is processed by the `Redactor` and dispatched to the active `Sink` (e.g., OTLP, Console).

### 2. Metric Aggregation

1. Every time `@agentsy/tokens` records usage, it also emits a metric event.
2. `@agentsy/observability` aggregates these into histograms and counters.
3. These metrics are exposed via a `Meter` for consumption by Prometheus or Grafana.

## Key Interfaces

### ObservabilityEngine

    export interface ObservabilityEngine {
      tracer: Tracer;
      meter: Meter;
      logger: Logger;
      setSink(sink: ObservabilitySink): void;
      setRedactionPolicy(policy: RedactionPolicy): void;
    }

### AgentSpan

    export interface AgentSpan {
      traceId: TraceId;
      spanId: string;
      parentId?: string;
      type: 'agent' | 'tool' | 'model' | 'internal';
      attributes: Record<string, string | number | boolean>;
      status: 'ok' | 'error';
    }

## Implementation Details

### OpenTelemetry Compatibility

The system should use `@opentelemetry/api` internally. This allows Agentsy traces to be seamlessly integrated into existing enterprise observability pipelines.

### Redaction Strategy

Redaction must happen at the `SpanProcessor` level, ensuring that sensitive data never leaves the local process in plaintext, even if a user incorrectly includes an API key in a prompt.

## Sources Synthesized

`agentsy-testing-plan.md`, `agentsy-prd.md`, `alignment-report-5-11-26.md`, `research/INFRASTRUCTURE-ANALYSIS.md`, `packages/observability/IMPLEMENTATION-PLAN.md`.

    promptTokens: number;
    completionTokens: number;
    responseTime: number;
    cost: number;
    effectiveness: number;

};

// Workflow tracing
workflowTraces: {
orchestration: Span;
subagentCalls: Span[];
contextSwitches: Span;
resultAggregation: Span;
};

// Conversation tracking
conversationTraces: {
conversationId: string;
turnNumber: number;
userIntent: string;
agentResponse: string;
satisfaction: number;
};
}

    #### 3. Metrics Collection System

    ```typescript
    interface MetricsCollection {
      // AI-specific metrics
      aiMetrics: {
        tokenUsage: Counter;
        modelLatency: Histogram;
        modelCost: Counter;
        responseQuality: Gauge;
        promptEffectiveness: Histogram;
      };

      // Agent performance metrics
      agentMetrics: {
        taskSuccessRate: Gauge;
        averageTaskDuration: Histogram;
        agentUtilization: Gauge;
        errorRate: Counter;
        throughput: Gauge;
      };

      // Resource metrics
      resourceMetrics: {
        memoryUsage: Gauge;
        cpuUsage: Gauge;
        networkIOTraffic: Counter;
        diskUsage: Gauge;
        concurrentTasks: Gauge;
      };

      // Business metrics
      businessMetrics: {
        userSatisfaction: Gauge;
        conversationCompletion: Gauge;
        featureAdoption: Counter;
        costPerInteraction: Histogram;
      };
    }

### 4. Event Recording System (Inspired by Tapes)

    interface EventRecordingSystem {
      // Conversation recording
      conversationRecording: {
        captureInteractions: boolean;
        recordStateChanges: boolean;
        captureToolCalls: boolean;
        storeInProgress: boolean;
      };

      // State management tracking
      stateTracking: {
        agentStateChanges: StateChangeEvent[];
        contextEvolution: ContextChange[];
        decisionPaths: DecisionPath[];
        selfCorrections: SelfCorrection[];
      };

      // Performance analysis
      performanceAnalysis: {
        regressionDetection: RegressionDetector;
        baselineComparison: BaselineComparator;
        optimizationOpportunities: OptimizationFinder;
        trendAnalysis: TrendAnalyzer;
      };

      // Debugging support
      debuggingSupport: {
        stepByStepReplay: ReplayEngine;
        stateSnapshot: StateSnapshotter;
        eventTimeline: EventTimeline;
        errorReproduction: ErrorReproducer;
      };
    }

#### 5. Knowledge Base Monitoring (Inspired by Clawtrace)

    interface KnowledgeBaseMonitoring {
      // RAG system tracking
      ragTracking: {
        queryLatency: Histogram;
        retrievalQuality: Gauge;
        relevanceScore: Histogram;
        indexHitRate: Gauge;
      };

      // Document access monitoring
      documentTracking: {
        documentViews: Counter;
        sourceEffectiveness: Gauge;
        updateImpact: Gauge;
        accessPatterns: AccessPattern[];
      };

      // Reasoning chain visibility
      reasoningTracking: {
        logicalSteps: LogicalStep[];
        confidenceScores: ConfidenceScore[];
        alternativePaths: AlternativePath[];
        selfCritiques: SelfCritique[];
      };
    }

### Advanced Features

#### 1. Distributed Agent Tracing

    interface DistributedTracing {
      // Cross-agent context propagation
      contextPropagation: {
        extractContext: (carrier: TextMapCarrier) => Context;
        injectContext: (context: Context, carrier: TextMapCarrier) => void;
        createSpan: (name: string, context?: Context) => Span;
      };

      // Agent communication tracking
      communicationTracking: {
        messageExchanges: MessageExchange[];
        protocolViolations: ProtocolViolation[];
        performanceBottlenecks: PerformanceBottleneck[];
        securityEvents: SecurityEvent[];
      };

      // Workflow orchestration visibility
      orchestrationVisibility: {
        workflowExecution: WorkflowExecution;
        dependencyTracking: DependencyTracking;
        resourceAllocation: ResourceAllocation;
        faultRecovery: FaultRecovery;
      };
    }

#### 2. Real-time Alerting System

    interface AlertingSystem {
      // Anomaly detection
      anomalyDetection: {
        performanceAnomalies: PerformanceAnomaly[];
        errorRateAnomalies: ErrorRateAnomaly[];
        costAnomalies: CostAnomaly[];
        behaviorAnomalies: BehaviorAnomaly[];
      };

      // Threshold monitoring
      thresholdMonitoring: {
        performanceThresholds: PerformanceThreshold[];
        resourceThresholds: ResourceThreshold[];
        qualityThresholds: QualityThreshold[];
        businessThresholds: BusinessThreshold[];
      };

      // Alert routing
      alertRouting: {
        channels: AlertChannel[];
        escalationPolicies: EscalationPolicy[];
        suppressionRules: SuppressionRule[];
        notificationTemplates: NotificationTemplate[];
      };
    }

#### 3. Analytics and Insights

    interface AnalyticsSystem {
      // Performance analytics
      performanceAnalytics: {
        trendAnalysis: TrendAnalysis;
        bottleneckIdentification: BottleneckIdentification;
        optimizationRecommendations: OptimizationRecommendation[];
      };

      // Usage analytics
      usageAnalytics: {
        featureUsage: FeatureUsage;
        userBehavior: UserBehavior;
        adoptionMetrics: AdoptionMetric[];
      };

      // Cost analytics
      costAnalytics: {
        costBreakdown: CostBreakdown;
        costOptimization: CostOptimization;
        budgetTracking: BudgetTracking;
      };

      // Quality analytics
      qualityAnalytics: {
        responseQuality: ResponseQuality;
        userSatisfaction: UserSatisfaction;
        improvementOpportunities: ImprovementOpportunity[];
      };
    }

### Implementation Phases

#### Phase 1: Core OpenTelemetry Integration

    # OpenTelemetry foundation
    src/
      core/
        observability.ts      # ObservabilityEngine
        tracer.ts            # Tracing setup
        metrics.ts           # Metrics setup
        logger.ts            # Logging setup
      instrumentation/
        http.ts              # HTTP instrumentation
        database.ts          # Database instrumentation
        runtime.ts           # Runtime instrumentation
      exporters/
        prometheus.ts        # Prometheus exporter
        jaeger.ts            # Jaeger exporter
        console.ts           # Console exporter

#### Phase 2: AI Agent-Specific Tracing

    # AI-specific observability
    src/
      ai/
        agent-tracer.ts      # Agent lifecycle tracing
        model-tracer.ts      # Model call tracing
        conversation-traces.ts # Conversation tracking
        workflow-traces.ts   # Workflow tracing
      attributes/
        ai-attributes.ts     # AI-specific span attributes
        agent-attributes.ts  # Agent-specific attributes
        conversation-attributes.ts # Conversation attributes

#### Phase 3: Event Recording System

    # Tapes-inspired recording system
    src/
      recording/
        conversation-recorder.ts # Conversation recording
        state-tracker.ts       # State change tracking
        replay-engine.ts       # Replay functionality
        event-timeline.ts      # Event timeline
      storage/
        event-storage.ts       # Event persistence
        cache-manager.ts       # Event cache management
        compression.ts         # Event compression

#### Phase 4: Knowledge Base Monitoring

    # Clawtrace-inspired monitoring
    src/
      knowledge/
        rag-monitor.ts         # RAG system monitoring
        document-tracker.ts    # Document access tracking
        reasoning-tracker.ts   # Reasoning chain tracking
        knowledge-analytics.ts # Knowledge base analytics
      metrics/
        knowledge-metrics.ts   # Knowledge-specific metrics
        retrieval-metrics.ts   # Retrieval performance
        reasoning-metrics.ts   # Reasoning quality

#### Phase 5: Advanced Analytics

    # Analytics and insights
    src/
      analytics/
        performance-analyzer.ts # Performance analysis
        usage-analyzer.ts      # Usage analysis
        cost-analyzer.ts       # Cost analysis
        quality-analyzer.ts    # Quality analysis
      alerting/
        anomaly-detector.ts    # Anomaly detection
        alert-router.ts        # Alert routing
        escalation-manager.ts  # Escalation management
      dashboard/
        query-api.ts          # Dashboard query API
        data-aggregator.ts     # Data aggregation
        visualization.ts       # Visualization helpers

### Usage Examples

#### 1. Agent Lifecycle Tracing

    import { ObservabilityEngine } from '@agentsy/observability';

    const observability = new ObservabilityEngine({
      serviceName: 'ai-agent-runtime',
      serviceVersion: '1.0.0',
      tracing: {
        jaegerEndpoint: 'http://localhost:14268/api/traces',
        sampling: 'always_on',
      },
      metrics: {
        prometheusEndpoint: 'http://localhost:9090',
        interval: 10000,
      },
    });

    // Trace agent execution
    const tracer = observability.getTracer();
    const span = tracer.startSpan('agent.task-execution', {
      attributes: {
        'agent.id': 'agent-123',
        'agent.type': 'code-reviewer',
        'task.id': 'task-456',
        'task.type': 'security-review',
      },
    });

    try {
      const result = await agent.execute(task);
      span.setAttributes({
        'task.success': true,
        'task.duration_ms': duration,
        'task.cost_usd': cost,
        'model.tokens_used': tokensUsed,
      });
      return result;
    } catch (error) {
      span.setAttributes({
        'task.success': false,
        'error.type': error.constructor.name,
        'error.message': error.message,
      });
      throw error;
    } finally {
      span.end();
    }

#### 2. Conversation Recording (Tapes style)

    import { ConversationRecorder } from '@agentsy/observability';

    const recorder = new ConversationRecorder({
      recordingPath: './recordings',
      captureStateChanges: true,
      captureToolCalls: true,
      compressionEnabled: true,
    });

    // Record conversation for debugging
    const recordingSession = recorder.start({
      conversationId: 'conv-789',
      userId: 'user-123',
      tags: ['code-review', 'security'],
    });

    recordingSession.recordUserMessage({
      content: 'Review this code for security issues',
      timestamp: Date.now(),
      metadata: { source: 'cli', priority: 'high' },
    });

    recordingSession.recordAgentAction({
      type: 'tool_call',
      tool: 'security_scanner',
      parameters: { file: 'src/auth.ts' },
      result: { vulnerabilities: 2 },
      timestamp: Date.now(),
    });

    recordingSession.recordAgentResponse({
      content: 'Found 2 security vulnerabilities...',
      reasoning: ['Analyzed input validation', 'Checked authentication'],
      confidence: 0.9,
      timestamp: Date.now(),
    });

    await recordingSession.complete();

#### 3. Knowledge Base Monitoring (Clawtrace style)

    import { KnowledgeBaseMonitor } from '@agentsy/observability';

    const kbMonitor = new KnowledgeBaseMonitor({
      indexType: 'vector',
      embeddingModel: 'text-embedding-3-small',
      metricsEnabled: true,
    });

    // Monitor RAG performance
    kbMonitor.trackQuery({
      query: 'authentication best practices',
      retrievedDocuments: 10,
      relevanceScore: 0.85,
      retrievalTime: 150,
      totalTokens: 500,
      costUsd: 0.002,
      timestamp: Date.now(),
    });

    // Monitor reasoning chain
    kbMonitor.trackReasoningStep({
      stepId: 'step-1',
      reasoning: 'Analyzed user intent for security review',
      confidence: 0.9,
      alternatives: ['Will check for XSS', 'Will check for SQL injection'],
      selfCritique: 'Should also check for CSRF',
      timestamp: Date.now(),
    });

    // Get performance insights
    const insights = await kbMonitor.getPerformanceInsights({
      timeRange: '24h',
      metrics: ['retrieval_quality', 'response_time', 'cost_efficiency'],
    });
    console.log('Average relevance score:', insights.averageRelevance);
    console.log('Cost per query:', insights.averageCost);

### Verification Criteria

- [ ] OpenTelemetry standards compliance
- [ ] Complete agent lifecycle tracing
- [ ] AI-specific metrics collection
- [ ] Real-time performance monitoring
- [ ] Conversation recording and replay
- [ ] Knowledge base effectiveness tracking
- [ ] Distributed tracing across agents
- [ ] Alerting and anomaly detection
- [ ] Analytics dashboard integration
- [ ] Production-ready performance

### Risk Register

- **High**: Performance overhead from comprehensive instrumentation
- **Medium**: Storage requirements for conversation recordings
- **Medium**: Complexity of distributed tracing in async workflows
- **Low**: OpenTelemetry implementation correctness
- **Low**: Metrics accuracy and completeness
- **Low**: Alert false positives

### Integration Points

- **runtime**: Trace agent execution and task processing
- **orchestrator**: Track workflow orchestration and agent coordination
- **memory**: Monitor memory operations and knowledge base access
- **session**: Track user sessions and conversation flow
- **subagents**: Monitor local agent execution
- **a2a**: Track remote agent communication

### Package Rename

Telemetry → Observability to better reflect the comprehensive monitoring, tracing, and analysis capabilities we're implementing, following industry standards from OpenTelemetry and enterprise observability platforms.

This observability platform provides enterprise-grade AI agent monitoring with the visibility needed to understand, debug, and optimize complex multi-agent workflows.

---

## Ecosystem Integration Analysis (2026-05-14)

### HIGH VALUE: Codeburn Analytics Integration

**Agentseal Codeburn for Cost-Yield Analysis**

- **Rationale:** Unique capabilities NOT found in standard observability: cost breakdown by task/model/tool/project, one-shot success rate analysis, yield analysis correlating agent sessions with git history, deterministic optimization suggestions without LLM calls
- **Expected Benefits:** Understanding cost patterns, identifying high-yield interventions, deterministic optimization recommendations
- **Implementation Strategy:** Complement existing OpenTelemetry with Codeburn-style analytics
- **ROI:** 3-6 months of building similar analytics engine

**Codeburn Capabilities:**

    // Codeburn integration for advanced analytics
    interface CodeburnIntegration {
      // Unique analytics capabilities
      analytics: {
        costBreakdown: 'Cost breakdown by task/model/tool/project';
        successRate: 'One-shot success rate analysis';
        yieldAnalysis: 'Correlate sessions with git history';
        optimization: 'Deterministic suggestions without LLM calls';
      };

      // Event-driven integration
      integration: {
        events: 'Event-driven integration with @agentsy/runtime traces';
        complements: 'Complement existing OpenTelemetry baselines';
        pattern: 'Cost-yield analysis + deterministic optimization';
      };

      // Strategic insights
      insights: {
        patterns: 'Understand cost patterns across agents and tools';
        interventions: 'Identify high-yield interventions';
        recommendations: 'Actionable optimization suggestions';
      };
    }

**Implementation Priorities:**

1. **Cost Breakdown Integration (Weeks 1-4):**
   - Cost breakdown by task, model, tool, project
   - Integration with @agentsy/runtime traces
   - Historical cost pattern analysis

2. **Success Rate Analysis (Weeks 5-8):**
   - One-shot success rate tracking
   - Agent performance comparison
   - Failure pattern identification

3. **Yield Analysis Integration (Weeks 9-12):**
   - Session-to-git-history correlation
   - Impact measurement of agent operations
   - Long-term value assessment

4. **Deterministic Optimization (Weeks 13-16):**
   - Optimization suggestions without LLM calls
   - Pattern-based recommendations
   - Cost-effectiveness validation

### Enhanced Observability Architecture

    // Enhanced observability with Codeburn integration
    interface EnhancedObservability {
      // Baseline OpenTelemetry integration
      baseline: {
        tracing: 'OpenTelemetry standard tracing';
        metrics: 'Standard metrics collection';
        logging: 'Structured logging framework';
        privacy: 'Redaction policies and safety';
      };

      // Enhanced Codeburn analytics
      enhanced: {
        costAnalysis: 'Cost breakdown by task/model/tool/project';
        successRate: 'One-shot success rate analysis';
        yieldAnalysis: 'Session-git history correlation';
        optimization: 'Deterministic optimization suggestions';
      };

      // Integration strategy
      integration: {
        pattern: 'Baseline OpenTelemetry + enhanced Codeburn';
        events: 'Event-driven with @agentsy/runtime traces';
        storage: 'Complementary storage and analysis';
      };

      // Expected combined benefits
      benefits: {
        visibility: 'Complete observability across all dimensions';
        optimization: 'Deterministic optimization without LLM overhead';
        analysis: 'Deep insights into cost patterns and agent effectiveness';
      };
    }

### Combined Benefits

**Enhanced Visibility:**

- **Complete observability:** Standard tracing + enhanced analytics
- **Deep insights:** Cost patterns, success rates, yield analysis
- **Actionable:** Deterministic optimization recommendations

**Cost Optimization:**

- **Breakdown analysis:** Understanding where costs are incurred
- **Pattern identification:** High-yield intervention opportunities
- **Optimization:** Deterministic suggestions without LLM costs

**Agent Performance:**

- **Success rates:** One-shot success rate tracking across agents
- **Yield analysis:** Understanding long-term agent value
- **Pattern recognition:** Identifying effective agent patterns

### Implementation Timeline

**Phase 1: Codeburn Integration (Weeks 1-16)**

- Cost breakdown integration (Weeks 1-4)
- Success rate analysis (Weeks 5-8)
- Yield analysis integration (Weeks 9-12)
- Deterministic optimization (Weeks 13-16)

**Integration Strategy:**

- **Baselines:** Keep OpenTelemetry for standard observability
- **Enhancements:** Add Codeburn for advanced analytics
- **Integration:** Event-driven with @agentsy/runtime traces

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Telemetry-to-observability mapping

`agentsy-tech.md` described a standalone `@agentsy/telemetry` package. In current topology, this concern is consolidated into `@agentsy/observability`.

### Required API compatibility

    interface TelemetryAdapter {
      startSpan(name: string, attributes?: Record<string, string | number>): Span;
      recordMetric(name: string, value: number, attributes?: Record<string, string>): void;
      shutdown(): Promise<void>;
    }

### Runtime expectation

- Lazy/no-op mode remains available for zero-cost instrumentation when disabled.
- AI-specific metrics (token usage, cost, latency) remain first-class observability attributes.
