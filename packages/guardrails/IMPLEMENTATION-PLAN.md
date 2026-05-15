# @agentsy/guardrails — Implementation Plan

## Purpose

`@agentsy/guardrails` is the policy enforcement layer for Agentsy. It should protect inputs, outputs, retrieval, memory, tools, network egress, and high-impact actions with a layered, local-first, human-accountable design.

It must also explicitly enforce the project’s ethical policy documents at runtime:

- `ETHICS.md`
- `SAFETY.md`
- `GOVERNANCE.md`
- `docs/constitution.md`

The package is optional and opt-in per agent, but when enabled it must be the canonical place for:

- safety and security checks
- privacy and redaction controls
- tool and retrieval authorization
- approval gates for high-impact actions
- policy tracing and audit receipts
- policy evaluation and red-team support

## Research-derived design principles

- **Layered defense**: do not rely on one model, one filter, or one provider.
- **Least privilege**: grant minimal access by default.
- **Deny by default**: sensitive actions require explicit authorization.
- **Local-first**: prefer offline or in-process checks before external calls.
- **Contestable decisions**: users must be able to see why something was blocked or allowed.
- **No raw sensitive data in logs**: redact secrets and PII at the boundary.
- **Risk-tiered policy**: low-, medium-, high-, and prohibited-risk handling.
- **Continuous evaluation**: guardrails degrade unless they are red-teamed and monitored.
- **Human oversight**: high-impact actions need approval and traceability.
- **Proportionality**: use the minimum intervention needed to reduce harm.

## Scope

The package should cover:

- ethical policy enforcement from the project policy documents
- input moderation
- output moderation
- prompt-injection detection
- retrieval-domain firewalling
- tool authorization and parameter validation
- PII and secret redaction
- memory safety and memory poisoning defenses
- egress control
- policy receipts and audit logging
- approval workflows for high-impact actions
- safety evaluation harnesses
- ethical impact assessment support

## Constraints

- Standalone package — not bundled into `@agentsy/orchestrator`
- Provider integrations remain optional
- Local validators must work without network access
- External providers must never receive raw secrets by default
- Safety failures must be observable, testable, and reviewable

## Ethical policy enforcement

The guardrails package must treat the project policy docs as authoritative runtime inputs, not advisory references.

### Policy sources

- `ETHICS.md` — human rights, accountability, proportionality, privacy, anti-anthropomorphism, and harm minimization
- `SAFETY.md` — runtime safety rules, approval gates, disallowed behaviors, and incident handling
- `GOVERNANCE.md` — policy review, versioning, release gates, and accountability roles
- `docs/constitution.md` — binding behavioral rules and enforcement priority

### Enforcement requirements

- Policies must be loaded, versioned, and interpreted as machine-enforceable rules.
- Conflicts must resolve in favor of human rights, safety, autonomy, privacy, and accountability.
- Ethical violations must be blocked, quarantined, redacted, or escalated based on risk tier and surface.
- Every refusal or escalation must include a policy ID, reason code, and a user-facing explanation.
- The same ethical rules must apply across input, retrieval, memory, tools, actions, output, egress, and receipts.

### Ethical enforcement tasks

- [ ] **P0 — TASK-G000** Load and version the project policy documents as canonical policy sources
  - Depends on: none
- [ ] **P0 — TASK-G000A** Build a policy registry that maps ethical clauses to machine-enforceable rules
  - Depends on: TASK-G000
- [ ] **P0 — TASK-G000B** Define policy precedence and conflict resolution for contradictory instructions or requests
  - Depends on: TASK-G000, TASK-G000A
- [ ] **P0 — TASK-G000C** Enforce ethical rules across all surfaces with deny/quarantine/escalate outcomes
  - Depends on: TASK-G000A, TASK-G000B
- [ ] **P0 — TASK-G000D** Add policy-linked refusal explanations and audit receipts for ethical violations
  - Depends on: TASK-G000C

## Priority legend

- **P0** — must exist before the first safe release of the package
- **P1** — required before default production use
- **P2** — hardening, observability, and long-tail governance

## Dependency notation

- Each checklist item includes a task ID and priority.
- `Depends on:` lists prerequisite tasks that should be complete first.
- Tasks in later phases may run in parallel once their dependencies are satisfied.

## Architecture

```text
User / external input
    → Intent and risk classifier
    → Prompt-injection / policy conflict checks
    → PII / secret redaction
    → Retrieval firewall and trust scoring
    → Tool authorization / parameter validation
    → Approval gate for high-impact actions
    → LLM or agent step
    → Output moderation / grounding / redaction
    → Audit receipt and telemetry
    → Consumer
```

### Policy model

Use a policy lattice with explicit states:

- `allow`
- `allow-with-redaction`
- `allow-with-approval`
- `deny`
- `quarantine`
- `escalate`

Every decision should include:

- policy ID
- decision
- reason code
- risk tier
- affected surface
- timestamp
- correlation ID

### Surface model

Guardrails must evaluate each surface independently:

- `input`
- `retrieval`
- `memory`
- `tool`
- `action`
- `output`
- `egress`

## Source layout

```text
packages/guardrails/src/
  index.ts
  config.ts
  decision.ts
  receipts/
    receipt.ts
    exporter.ts
  policy/
    policy-engine.ts
    risk.ts
    allowlists.ts
    rules.ts
  providers/
    interface.ts
    regex.ts
    pii.ts
    prompt-injection.ts
    secrets.ts
    moderation.ts
    local-reasoner.ts
  pipeline/
    input.ts
    retrieval.ts
    memory.ts
    tool.ts
    output.ts
    egress.ts
    streaming.ts
  approvals/
    approval-gate.ts
    approval-policy.ts
  audit/
    logger.ts
    redaction.ts
  eval/
    benchmark.ts
    adversarial-cases.ts
    scoring.ts
    monitor.ts
  compliance/
    impact-assessment.ts
    redress.ts
```

## Core types

```ts
interface GuardrailsConfig {
  providers: GuardrailProvider[];
  allowedTopics?: string[];
  blockedTopics?: string[];
  riskTier?: 'low' | 'moderate' | 'high' | 'prohibited';
  piiRedaction?: boolean;
  secretRedaction?: boolean;
  tokenQuota?: { maxSessionTokens: number };
  retrievalDomains?: string[];
  toolAllowList?: string[];
  egressAllowList?: string[];
  memoryPolicy?: 'off' | 'minimal' | 'session' | 'persistent';
  approvalRequiredFor?: string[];
  trustHierarchy?: ('system' | 'user' | 'retrieved')[];
  stripUntrustedContext?: boolean;
  localOnly?: boolean;
}

interface GuardrailDecision {
  decision: 'allow' | 'allow-with-redaction' | 'allow-with-approval' | 'deny' | 'quarantine' | 'escalate';
  reasonCode: string;
  riskTier: 'low' | 'moderate' | 'high' | 'prohibited';
  surface: 'input' | 'retrieval' | 'memory' | 'tool' | 'action' | 'output' | 'egress';
  policyId: string;
  confidence?: number;
  redactedFields?: string[];
  requiresHumanApproval?: boolean;
}
```

## Implementation checklist

### Phase 1 — Policy foundation

- [ ] **P0 — TASK-G001** Define `GuardrailsConfig`, `GuardrailDecision`, and stable reason codes
  - Depends on: TASK-G000A, TASK-G000B
- [ ] **P0 — TASK-G002** Implement `PolicyEngine` with allow/deny/quarantine/escalate states
  - Depends on: TASK-G001
- [ ] **P0 — TASK-G003** Add surface-specific evaluation for input, retrieval, memory, tool, action, output, and egress
  - Depends on: TASK-G001, TASK-G002
- [ ] **P0 — TASK-G004** Add risk-tier mapping and approval requirements
  - Depends on: TASK-G001, TASK-G002
- [ ] **P0 — TASK-G005** Add correlation IDs and decision receipts
  - Depends on: TASK-G001, TASK-G002

### Phase 2 — Privacy and data protection

- [ ] **P0 — TASK-G010** Implement PII redaction with configurable entity sets
  - Depends on: TASK-G001, TASK-G002
- [ ] **P0 — TASK-G011** Implement secret detection/redaction for keys, tokens, and credentials
  - Depends on: TASK-G001, TASK-G002
- [ ] **P0 — TASK-G012** Add memory retention modes and explicit user-controlled memory boundaries
  - Depends on: TASK-G001, TASK-G002, TASK-G003
- [ ] **P0 — TASK-G013** Ensure logs store labels and hashes, not raw sensitive values
  - Depends on: TASK-G010, TASK-G011

### Phase 3 — Prompt injection and retrieval safety

- [ ] **P0 — TASK-G020** Detect direct and indirect prompt injection in user input and retrieved context
  - Depends on: TASK-G001, TASK-G002, TASK-G010, TASK-G011
- [ ] **P0 — TASK-G021** Add retrieval-domain allowlists and trust scoring for external sources
  - Depends on: TASK-G001, TASK-G002, TASK-G003
- [ ] **P0 — TASK-G022** Block or quarantine conflicting instructions from untrusted context
  - Depends on: TASK-G020, TASK-G021
- [ ] **P0 — TASK-G023** Add memory poisoning detection for persisted instructions and notes
  - Depends on: TASK-G012, TASK-G020

### Phase 4 — Tool, action, and egress control

- [ ] **P0 — TASK-G030** Enforce tool allowlists and parameter schemas
  - Depends on: TASK-G001, TASK-G002, TASK-G004
- [ ] **P0 — TASK-G031** Add approval gates for high-impact tool calls and outbound actions
  - Depends on: TASK-G004, TASK-G030
- [ ] **P0 — TASK-G032** Add egress allowlists for network requests and external uploads
  - Depends on: TASK-G001, TASK-G002, TASK-G021
- [ ] **P1 — TASK-G033** Add rollback/undo metadata for reversible actions
  - Depends on: TASK-G031

### Phase 5 — Output moderation and provenance

- [ ] **P0 — TASK-G040** Moderate outputs for harmful content, deception, and overconfident assertions
  - Depends on: TASK-G001, TASK-G002, TASK-G003
- [ ] **P1 — TASK-G041** Add provenance-aware output labeling for generated vs retrieved content
  - Depends on: TASK-G040
- [ ] **P1 — TASK-G042** Add refusal and safe-completion templates with stable reason codes
  - Depends on: TASK-G040
- [ ] **P1 — TASK-G043** Add anti-anthropomorphism guidance for user-facing language
  - Depends on: TASK-G040, TASK-G041

### Phase 6 — Auditing and receipts

- [ ] **P1 — TASK-G050** Implement audit logger with redacted events only
  - Depends on: TASK-G010, TASK-G011, TASK-G013
- [ ] **P1 — TASK-G051** Export machine-readable decision receipts for compliance and debugging
  - Depends on: TASK-G005, TASK-G050
- [ ] **P1 — TASK-G052** Add reviewable trace summaries for blocked, redacted, and approved actions
  - Depends on: TASK-G050, TASK-G051
- [ ] **P1 — TASK-G053** Support local-first operation with optional external telemetry sinks
  - Depends on: TASK-G050, TASK-G051

### Phase 7 — Evaluation and red teaming

- [ ] **P1 — TASK-G060** Build adversarial prompt suites for jailbreaks, injection, and escalation
  - Depends on: TASK-G020, TASK-G022, TASK-G040
- [ ] **P1 — TASK-G061** Add tests for PII leakage, secret leakage, and hallucinated authority
  - Depends on: TASK-G010, TASK-G011, TASK-G040
- [ ] **P1 — TASK-G062** Add tests for tool misuse, egress abuse, and memory poisoning
  - Depends on: TASK-G023, TASK-G030, TASK-G032
- [ ] **P1 — TASK-G063** Add risk regression scoring and continuous monitoring hooks
  - Depends on: TASK-G050, TASK-G051, TASK-G060

### Phase 8 — Ethical and governance support

- [ ] **P1 — TASK-G070** Add ethical impact assessment support for high-risk features
  - Depends on: TASK-G004, TASK-G031, TASK-G063
- [ ] **P1 — TASK-G071** Add contestability and redress metadata for blocked or transformed outputs
  - Depends on: TASK-G005, TASK-G051, TASK-G052
- [ ] **P1 — TASK-G072** Add policy versioning and changelog hooks
  - Depends on: TASK-G001, TASK-G005, TASK-G051
- [ ] **P1 — TASK-G073** Add user-facing explanations for why an action was denied or escalated
  - Depends on: TASK-G002, TASK-G040, TASK-G051

## Dependency summary

### Critical path

1. `TASK-G000` to `TASK-G000D` establish authoritative ethical policy enforcement.
2. `TASK-G001` establishes the shared decision vocabulary.
3. `TASK-G002` introduces the policy engine.
4. `TASK-G003` to `TASK-G005` make the policy engine usable across surfaces.
5. `TASK-G010` to `TASK-G023` secure data and context boundaries.
6. `TASK-G030` to `TASK-G033` constrain tools, actions, and egress.
7. `TASK-G040` to `TASK-G043` protect outputs and user perception.
8. `TASK-G050` to `TASK-G053` make behavior auditable.
9. `TASK-G060` to `TASK-G063` prove the system resists abuse.
10. `TASK-G070` to `TASK-G073` tie the package back to governance and redress.

## Provider guidance

Providers should be layered, not singular.

Recommended ordering:

1. deterministic local checks
2. regex and schema validators
3. local or self-hosted classifiers
4. optional external moderation or specialized models
5. human review for high-impact outputs

### Optional local reasoning support

A local reasoning sidecar can be used to explain or score policy decisions without sending sensitive data externally. This should remain a support component, not a source of authority over policy.

## Acceptance criteria

The package is ready when it can:

- explicitly enforce the project’s ethical policy documents at runtime
- block prompt injection and injected tool instructions
- redact PII and secrets before logs or external calls
- enforce retrieval, tool, memory, and egress restrictions
- require approval for high-impact actions
- produce auditable decision receipts
- run meaningful offline tests
- support policy review and versioning
- keep user control, autonomy, and dignity visible in the interface

## Alternatives rejected

- Inline guardrails into the orchestrator — rejected: weak separation of concerns and poorer reuse
- Vendor-only moderation — rejected: lock-in and poor local-first coverage
- Output-only filtering — rejected: misses retrieval, memory, tool, and egress risk
- Hidden approvals — rejected: poor transparency and weak user control
- Unlimited memory retention — rejected: privacy and redress risk
