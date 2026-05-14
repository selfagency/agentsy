# @agentsy/guardrails — Implementation Plan

## Purpose

Standalone, pluggable safety and security guardrails for the `@agentsy` platform. Provides input/output moderation pipelines, PII redaction, intent classification, retrieval domain firewalling, token quota enforcement, streaming filters, and regulatory compliance audit trails.

Always an optional dependency — consumers opt in per-agent.

Source: `plan/owasp-security-testing-1.md` (tasks TASK-T071..T090 + REQ-076..REQ-090)

---

## Requirements

- **REQ-076**: `GuardrailsController` API for per-agent input/output moderation policy configuration
- **REQ-077**: Pluggable `GuardrailProvider` interface — OpenAI Moderation, Llama Guard, regex, custom
- **REQ-078**: Per-agent policy: `allowedTopics`, `blockedTopics`, `trustHierarchy`, hard-refusal rules, `ALLOWED_TOOLS`
- **REQ-079**: PII detection and redaction on both input (before LLM) and output (before response delivery)
- **REQ-080**: Prompt injection detection (direct and indirect) at input validation stage
- **REQ-081**: Output moderation categories: toxic language, sexual content, violence, self-harm, hate speech, specialized advice (legal/medical/financial)
- **REQ-082**: Typed observability events: `guardrail:blocked`, `guardrail:pii-redacted`, `guardrail:quota-exceeded`
- **REQ-083**: Streaming guardrails — filters run on sliding window chunks, no full-response buffering; < 50 ms p99 latency overhead per chunk
- **REQ-084**: Adversarial bypass test suite: jailbreak patterns, indirect injection, multi-step escalation
- **REQ-085**: RAG retrieval source domain allowlist firewall — blocks untrusted context injection
- **REQ-086**: Per-session token quotas enforced to prevent denial-of-wallet attacks
- **REQ-087**: Intent classifier ("bouncer") rejects out-of-scope queries before reaching the primary LLM
- **REQ-088**: Regulatory compliance audit trail per-request (EU AI Act, NIST AI RMF, GDPR/HIPAA)
- **REQ-089**: Application-level safety testing: `safetyScore = safeResponses / totalProbes`
- **REQ-090**: OWASP LLM Top 10:2025 (LLM01–LLM10) AND OWASP Agentic Top 10:2026 (ASI01–ASI10) test coverage

### Constraints

- **CON-014**: Must be a standalone package — not bundled into `@agentsy/orchestrator`
- **CON-015**: Provider integrations (openai, llama-guard) must be optional peer dependencies
- **CON-016**: Streaming filter adds < 50 ms p99 latency overhead per chunk
- **CON-017**: False positive rate for content filtering < 1%

---

## Architecture

```text
Input message
    → IntentClassifier (scope check)
    → InputPipeline: [ PromptInjectionDetector, PiiRedactionProvider, RegexProvider, ... ]
    → LLM
    → OutputPipeline: [ ContentModerationProvider, PiiRedactionProvider, RegexProvider, ... ]
    → StreamingGuardrailFilter (wraps AsyncIterable<string>)
    → Consumer
```

Each stage emits typed `guardrail:*` events for observability (`@agentsy/observability`).

### Reference integrations

Guardrails should remain the policy layer, not the telemetry or replay layer, but they should still publish outputs that other systems can consume cleanly.

- **OpenEvals-style safety scoring** can be used by consumers to measure pass/fail behavior over adversarial suites.
- **Tapes-style recordings** can store blocked/redacted safety events for deterministic debugging without keeping raw secrets in logs.
- **Ratify-compatible receipts** can be used by hosts that need cryptographic evidence for approvals or policy decisions.
- **MCP trust levels** should remain aligned with the same trust vocabulary used by the runtime and connector packages.

---

## Source Layout

```text
packages/guardrails/src/
  index.ts                          — barrel export
  config.ts                         — GuardrailsConfig, GuardrailResult, GuardrailEvent
  controller.ts                     — GuardrailsController class
  providers/
    interface.ts                    — GuardrailProvider interface
    regex.ts                        — RegexProvider + PiiRedactionProvider (zero deps)
    openai-moderation.ts            — OpenAIModerationProvider (optional peer: openai)
    llama-guard.ts                  — LlamaGuardProvider (optional peer: openai-compatible client)
  pipeline/
    input.ts                        — Input validation pipeline
    output.ts                       — Output filtering pipeline
    streaming.ts                    — StreamingGuardrailFilter (sliding window)
  intent/
    classifier.ts                   — IntentClassifier
  retrieval/
    firewall.ts                     — RetrievalFirewall
  quota/
    manager.ts                      — TokenQuotaManager
  audit/
    logger.ts                       — AuditLogger (no PII in logs)
    exporter.ts                     — AuditExporter (JSON Lines, EU AI Act Art. 12)
  __tests__/
    controller.test.ts
    providers.test.ts
    streaming.test.ts
    quota.test.ts
    audit.test.ts
```

---

## Core Types (`config.ts`)

```ts
interface GuardrailsConfig {
  providers: GuardrailProvider[];
  allowedTopics?: string[];
  blockedTopics?: string[];
  piiRedaction?: boolean;
  tokenQuota?: { maxSessionTokens: number };
  retrievalDomains?: string[]; // allowlist
  trustHierarchy?: ('system' | 'user' | 'retrieved')[];
  egressAllowList?: string[];
  crossUserDataAccess?: boolean;
  stripUntrustedContext?: boolean;
}

interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  category?: string;
  piiRedacted?: boolean;
  redactedFields?: string[];
  inScope?: boolean;
  intent?: string;
  confidence?: number;
}
```

### Output contract notes

- Redaction events should include field names and policy reason codes, but never raw sensitive values.
- Blocked requests should return a stable machine-readable category so dashboards and tests can trend regressions.
- Streaming filters must preserve partial-output state across chunks so split PII and split jailbreak patterns are still caught.

---

## Implementation Tasks

### Phase 9 — Core Package

| Task      | Description                                                                                      | Status |
| --------- | ------------------------------------------------------------------------------------------------ | ------ |
| TASK-T071 | Scaffold: `package.json`, `tsconfig.json`, `tsup.config.ts`, barrel `index.ts`                   | ❌     |
| TASK-T072 | `GuardrailsConfig` interface + `GuardrailResult` type                                            | ❌     |
| TASK-T073 | `GuardrailsController`: `checkInput()`, `checkOutput()`, typed events                            | ❌     |
| TASK-T074 | `RegexProvider` + `PiiRedactionProvider` (zero runtime deps)                                     | ❌     |
| TASK-T075 | `OpenAIModerationProvider` (optional peer `openai`)                                              | ❌     |
| TASK-T076 | `LlamaGuardProvider` (optional peer: OpenAI-compatible client)                                   | ❌     |
| TASK-T077 | `IntentClassifier` with allow/deny topic lists + pluggable backend                               | ❌     |
| TASK-T078 | `StreamingGuardrailFilter` — sliding window, no full buffering, < 50 ms overhead                 | ❌     |
| TASK-T079 | `RetrievalFirewall.validate(url)` — `retrievalDomains` allowlist, throws `RetrievalBlockedError` | ❌     |
| TASK-T080 | `TokenQuotaManager` — per-session tracking, `guardrail:quota-exceeded`, `QuotaExceededError`     | ❌     |

### Phase 10 — Application-Level Safety Testing

| Task      | Description                                                                                                                               | Status |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TASK-T081 | Safety risk taxonomy: Undesirable Content, Specialized Advice, Political Content, Privacy Violation                                       | ❌     |
| TASK-T082 | Adversarial prompt benchmark: ≥ 50 basic + ≥ 20 intermediate prompts per category → `packages/testing/src/__fixtures__/safety-benchmark/` | ❌     |
| TASK-T083 | Safety score CI gate: `safetyScore ≥ 0.90` in nightly CI; report to LangWatch                                                             | ❌     |
| TASK-T084 | LLM-as-judge `JudgeAgent`: ≥ 85% agreement against ≥ 50 human-annotated examples                                                          | ❌     |
| TASK-T085 | PR template safety checklist + `docs/developers/safety-assessment-template.md`                                                            | ❌     |

### Phase 11 — Regulatory Compliance

| Task      | Description                                                                                | Status |
| --------- | ------------------------------------------------------------------------------------------ | ------ |
| TASK-T086 | EU AI Act risk classification doc → `docs/compliance/eu-ai-act.md`                         | ❌     |
| TASK-T087 | NIST AI RMF mapping → `docs/compliance/nist-ai-rmf.md`                                     | ❌     |
| TASK-T088 | `AuditLogger` — per-request intervention, timestamp, redacted field names only, no raw PII | ❌     |
| TASK-T089 | Real-time compliance dashboard: intervention rate, false positive rate, latency p99        | ❌     |
| TASK-T090 | `AuditExporter.export(dateRange)` → JSON Lines (EU AI Act Article 12)                      | ❌     |

---

## OWASP Test Coverage

### OWASP LLM Top 10:2025 (LLM01–LLM10)

| Test      | Vulnerability                   | Description                                                                 |
| --------- | ------------------------------- | --------------------------------------------------------------------------- |
| TASK-T051 | LLM01 Prompt Injection          | Direct role override + indirect injection via retrieved context             |
| TASK-T052 | LLM02 Sensitive Info Disclosure | System prompt not leaked, PII not echoed, API keys not reflected            |
| TASK-T053 | LLM03 Supply Chain              | Tool descriptor signatures, unsigned MCP server rejection, dep audit        |
| TASK-T054 | LLM04 Data Poisoning            | RAG poisoning — malicious instruction in retrieved doc blocked by guardrail |
| TASK-T055 | LLM05 Improper Output Handling  | HTML-escaped output, tool output schema validation                          |
| TASK-T056 | LLM06 Excessive Agency          | `ALLOWED_TOOLS` enforcement, tool permission scope                          |
| TASK-T057 | LLM07 System Prompt Leakage     | Adversarial extraction attempts blocked                                     |
| TASK-T058 | LLM08 Vector/Embedding Weakness | Cross-tenant embedding isolation                                            |
| TASK-T059 | LLM09 Misinformation            | Refusal rate ≥ 80% on out-of-knowledge queries                              |
| TASK-T060 | LLM10 Unbounded Consumption     | Token bomb test, session quota enforcement                                  |

### OWASP Agentic Top 10:2026 (ASI01–ASI10)

| Test      | Vulnerability                   | Description                                                         |
| --------- | ------------------------------- | ------------------------------------------------------------------- |
| TASK-T061 | ASI01 Agent Goal Hijack         | Crescendo multi-turn test — conflicting objective injection         |
| TASK-T062 | ASI02 Tool Misuse               | `ToolUsageGuard` — parameter validation, rate limiting, sandbox     |
| TASK-T063 | ASI03 Identity/Privilege Abuse  | NHI credential scoping, no cross-invocation credential inheritance  |
| TASK-T064 | ASI04 Agentic Supply Chain      | MCP server manifest hash verification                               |
| TASK-T065 | ASI05 Unexpected Code Execution | Agent-generated code in sandbox, no host FS/network access          |
| TASK-T066 | ASI06 Memory Poisoning          | Malicious instruction in persistent memory quarantined on retrieval |
| TASK-T067 | ASI07 Inter-Agent Communication | Signed inter-agent messages, spoofed agent rejected                 |
| TASK-T068 | ASI08 Cascading Failures        | Circuit breaker — false signal from one agent not propagated        |
| TASK-T069 | ASI09 Human-Agent Trust         | HITL approval for high-risk tool calls, confidence surfaced         |
| TASK-T070 | ASI10 Rogue Agent Detection     | Behavioral anomaly detection vs declared capability spec            |

---

## Key Test Cases

- **TEST-007**: `RegexProvider` blocks known jailbreak pattern: `{ blocked: true, reason: string }`
- **TEST-008**: `PiiRedactionProvider` replaces email pattern: `{ piiRedacted: true, redactedFields: ["email"] }`
- **TEST-009**: `OpenAIModerationProvider` maps `hate: true` → `{ blocked: true, category: "hate" }`
- **TEST-010**: `LlamaGuardProvider` maps `"unsafe\nS1"` → `{ blocked: true, category: "violent_crimes" }`
- **TEST-011**: `StreamingGuardrailFilter` — PII pattern split across chunk boundary, redaction applied correctly
- **TEST-012**: `IntentClassifier` — query outside `allowedTopics` → `{ inScope: false, intent: "off-topic" }`
- **TEST-013**: `RetrievalFirewall` — URL not in `retrievalDomains` → throws `RetrievalBlockedError`
- **TEST-014**: `TokenQuotaManager` — exceed `maxSessionTokens` → throws `QuotaExceededError`
- **TEST-015**: `AuditLogger` — entry has `timestamp`, `type`, `provider`; no raw PII in log
- **TEST-016**: Safety score CI gate — 92% → pass; 88% → fail
- **TEST-017**: Lethal Trifecta (user session data + user-supplied URL fetch + network egress) blocked unless all 3 mitigated
- **TEST-018**: PII tokenization round-trip — LLM sees tokens, delivery adapter gets resolved values, audit log records tokens only
- **TEST-019**: Action trace kill-switch — `file_write` at turn > 10 halts loop, `LoopAborted` emitted, no further tool calls
- **TEST-020**: Cryptographic receipt integrity — tampered receipt detected, `ReceiptTamperedError` logged
- **TEST-021**: Circuit breaker — 3 consecutive failures → `SchedulerCircuitOpen`; `resetCircuit()` resumes

---

## Dependencies

- `@agentsy/types` — shared types
- `@agentsy/observability` — emit `guardrail:*` events
- `@agentsy/testing` (dev) — test utilities, `FaultInjector`, `createMockLLM`, `RedTeamAgent`
- `@langwatch/scenario` (dev) — `RedTeamAgent.crescendo()`, `JudgeAgent`
- `openai` (optional peer) — `OpenAIModerationProvider`

## Guidelines

- **GUD-005**: Least agency — grant minimum tool permissions per task
- **GUD-006**: System prompts as policy: identity → job → hard refusals/trust hierarchy → output guardrails → input spec → output format → example → reiterate refusals
- **GUD-007**: Safety testing layers: unit → integration → scenario → red team (crescendo escalation)
- **GUD-008**: LLM-as-judge validators need ≥ 85% human annotation agreement before CI gate use

## Alternatives Rejected

- **ALT-001**: Inline into `@agentsy/orchestrator` — rejected: violates single-responsibility, prevents independent versioning
- **ALT-002**: NeMo Guardrails only — rejected: requires NVIDIA SDK, hard dep
- **ALT-003**: OWASP LLM Top 10 only — rejected: ASI01–ASI10 covers agentic-specific risks not in LLM taxonomy
- **ALT-004**: Full-buffering guardrails on output — rejected: latency proportional to response length
- **ALT-005**: OpenAI Moderation as sole provider — rejected: vendor lock-in
- **ALT-006**: Safety scoring at unit test level only — rejected: application-level black-box catches failures unit tests miss
