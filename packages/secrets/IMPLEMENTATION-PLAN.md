---
goal: @agentsy/secrets production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: secrets-maintainers
status: In progress
tags: [feature, architecture, secrets, security, key-management]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/secrets` as secure credentials lifecycle authority.

## 1. Requirements & Constraints

- **REQ-SECRETS-001**: Secret access supports keychain/env/encrypted backend strategies with deterministic precedence.
- **REQ-SECRETS-002**: Setup/doctor flows provide safe diagnostics without exposing secret values.
- **REQ-SECRETS-003**: Rotation/update workflows avoid downtime and stale credential use.
- **REQ-SECRETS-004**: Access telemetry is auditable and redacted.
- **SEC-SECRETS-001**: No plaintext credential persistence in user config or logs.
- **SEC-SECRETS-002**: Secret retrieval requires scoped access context and least privilege.
- **CON-SECRETS-001**: Provider transport/auth logic remains in providers package.
- **CON-SECRETS-002**: UI prompting remains in CLI/surface packages.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-SECRETS-001: Contract and backend strategy stabilization.

| Task             | Description                                                            | Completed | Date |
| ---------------- | ---------------------------------------------------------------------- | --------- | ---- |
| TASK-SECRETS-001 | Stabilize secrets API contract and backend selection precedence model. |           |      |
| TASK-SECRETS-002 | Add typed tests for backend fallback and access error taxonomy.        |           |      |
| TASK-SECRETS-003 | Document security boundary ownership with CLI/providers/runtime.       |           |      |

### Implementation Phase 2

- GOAL-SECRETS-002: Core secrets subsystem completion.

| Task             | Description                                                     | Completed | Date |
| ---------------- | --------------------------------------------------------------- | --------- | ---- |
| TASK-SECRETS-004 | Implement keychain/env/encrypted file adapters with validation. |           |      |
| TASK-SECRETS-005 | Implement rotation/update and invalidation behavior.            |           |      |
| TASK-SECRETS-006 | Implement safe diagnostics APIs for setup/doctor workflows.     |           |      |

### Implementation Phase 3

- GOAL-SECRETS-003: Integration and operations.

| Task             | Description                                                               | Completed | Date |
| ---------------- | ------------------------------------------------------------------------- | --------- | ---- |
| TASK-SECRETS-007 | Integrate provider/runtime/CLI secret flows and reference semantics.      |           |      |
| TASK-SECRETS-008 | Add integration tests for secret lookup precedence and rotation behavior. |           |      |
| TASK-SECRETS-009 | Emit redacted access telemetry for audit support.                         |           |      |

### Implementation Phase 4

- GOAL-SECRETS-004: Hardening and release gates.

| Task             | Description                                                                   | Completed | Date |
| ---------------- | ----------------------------------------------------------------------------- | --------- | ---- |
| TASK-SECRETS-010 | Add failure-mode regressions for backend unavailability and corrupted stores. |           |      |
| TASK-SECRETS-011 | Update docs and operator safety guidance.                                     |           |      |
| TASK-SECRETS-012 | Pass package and monorepo release gates.                                      |           |      |

## 3. Acceptance Criteria

- **ACC-SECRETS-001**: Secret handling behavior is deterministic and secure by default.
- **ACC-SECRETS-002**: Provider/CLI integration flows pass with redaction guarantees.
- **ACC-SECRETS-003**: Security and release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/secrets.md`
- `packages/secrets/README.md`
- `packages/secrets/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/secrets — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/secrets` is the **security vault** of the framework. It provides a unified, secure interface for managing sensitive information like LLM API keys and provider tokens. It ensures that credentials are never stored in plaintext and that they are only accessible to authorized components.

It is consumed by `@agentsy/core/universal-client` (for authentication) and `@agentsy/cli` (for credential management commands).

### Ecosystem Sketch

```text
[ @agentsy/cli ]       [ @agentsy/core ]
      |                        |
      v                        v
[ @agentsy/secrets ] <--- Secure Retrieval
      |
      +-----------------------+-----------------------+
      |                       |                       |
      v                       v                       v
 [ OS Keychain ]        [ Env Variables ]       [ Encrypted File ]
 (Mac/Win/Linux)        (Docker / CI)           (Dev Fallback)
```

## Fulfillment of Role

The package fulfills its role by implementing a tiered storage strategy:

1. **SecretStore Abstraction**: A common interface for all storage backends.
2. **Platform-Native Keychain**: Integrating with macOS Keychain, Windows DPAPI, and Linux libsecret.
3. **Secure Encryption**: AES-256 encryption for local file-based storage.
4. **Source Precedence**: Explicitly defined priority (`Keychain` > `Env` > `File`).
5. **Redaction**: Integrated tools to scrub secrets from logs and traces.

## Detailed Functionality

### 1. Storage Backends (`src/store/`)

- **Mechanism**: `SecretStore` implementations for each platform.
- **Keychain**: Uses `keytar` or native bindings for production-grade security.
- **File**: Atomic, encrypted writes with restricted file permissions.
- **Environment**: Read-only wrapper for `process.env`.

### 2. Validation & Redaction (`src/security/`)

- **SecretValidator**: Ensures that API keys match the expected format for their provider.
- **SecretRedactor**: Provides a global utility to replace known secrets with `[REDACTED]` in strings.

### 3. Provider Integration (`src/providers/`)

- **Mechanism**: Automatic loading of credentials based on provider name (e.g., `openai` looks for `OPENAI_API_KEY`).
- **Endpoint Support**: Handles custom endpoints and organization IDs for enterprise deployments.

## Logic & Data Flow

### 1. Retrieval Flow

1. `@agentsy/core/universal-client` requests credentials for a provider.
2. `SecretManager.getCredentials(provider)` is called.
3. The manager iterates through the stores in order of precedence.
4. Once found, the secret is returned as a `ProviderCredentials` object.
5. If not found, a descriptive `MissingSecretError` is thrown.

### 2. Management Flow

1. User runs `agentsy config set openai.apiKey ...`.
2. CLI calls `SecretManager.setCredentials()`.
3. The manager identifies the most secure available store (usually Keychain).
4. The secret is validated and then persisted to the store.

## Key Interfaces

### SecretStore

```typescript
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
```

### ProviderCredentials

```typescript
export interface ProviderCredentials {
  provider: string;
  apiKey: string;
  organizationId?: string;
  endpoint?: string;
}
```

Each credential carries an identity context (user, agent, service) so that the same secret store can serve multiple principals with different access levels.

## Implementation Details

### Source Precedence

The default precedence must be:

1. **Keychain**: Highest priority, most secure.
2. **Environment Variables**: For CI/CD and containerized environments.
3. **Encrypted File**: Lowest priority, for local development fallback.

### Memory Safety

Sensitive data should be cleared from memory as soon as it is no longer needed. The `SecretStore` should handle buffers carefully to avoid leaving traces in garbage-collected memory.

## Sources Synthesized

`DECISION-LOG.md`, `owasp-security-testing-1.md`, `agentsy-prd.md`, `agentsy-testing-plan.md`, `packages/secrets/IMPLEMENTATION-PLAN.md`.

- `cli` - Secret management commands

### Security Requirements

- No secrets in memory longer than necessary
- Secure key derivation for file encryption
- Platform-specific secure storage APIs
- Audit trail for secret access (optional)
- When a credential fails with an auth error, automatically trigger credential rotation and retry once. If rotation also fails, surface a credential-rotation-failed event to observability and fail gracefully.

### Source Plan References

- `plan/agentsy-tech.md` §4.3 - Secret management strategy
- `plan/agentsy-providers.md` §5.2 - Provider authentication
- Security best practices for API key storage

### Implementation Milestones

#### Phase 1: Core Infrastructure

- [ ] SecretStore interface definition
- [ ] Keychain store implementation
- [ ] File store with encryption
- [ ] Environment store fallback
- [ ] Basic SecretManager class

#### Phase 2: Provider Integration

- [ ] ProviderCredentials interface
- [ ] Automatic credential loading
- [ ] Provider-specific validation
- [ ] Error handling patterns

#### Phase 3: Advanced Features

- [ ] Secret rotation utilities
- [ ] Migration tools between stores
- [ ] Redaction utilities for logging
- [ ] CLI integration commands
- [ ] Support dynamic credentials that resolve at time of use rather than at session start. Credential providers may register resolvers that fetch tokens on demand.
- [ ] Support OAuth 2.1 device authorization flow and client credentials grant for long-running agent sessions. Token refresh must be transparent to the caller.

#### Phase 4: Security Hardening

- [ ] Memory management for secrets
- [ ] Access logging and audit trails
- [ ] Platform-specific security features
- [ ] Security testing and validation

### Verification Criteria

- [ ] All store backends work cross-platform
- [ ] Secrets never appear in logs or stack traces
- [ ] Encryption passes security audit
- [ ] Provider integration seamless
- [ ] No memory leaks in secret handling

### File Structure

```text
packages/secrets/src/
├── index.ts                 # Public exports
├── stores/
│   ├── keychain.ts         # System keychain store
│   ├── file.ts             # Encrypted file store
│   ├── env.ts              # Environment variable store
│   └── index.ts            # Store factory
├── providers/
│   ├── credentials.ts      # Provider credential types
│   └── loader.ts           # Automatic credential loading
├── validation/
│   ├── validator.ts        # Secret validation
│   └── sanitizer.ts        # Secret sanitization
└── security/
    ├── memory.ts           # Secure memory handling
    └── audit.ts            # Access logging
```

### Risk Register

- **Medium**: Platform-specific keychain API complexity
- **Medium**: Encryption algorithm selection and maintenance
- **Low**: File permission security edge cases
- **Low**: Memory cleanup timing issues

---

## Ecosystem Integration Analysis (2026-05-14)

### CRITICAL: Varlock Schema-First Secrets Integration

**Schema-First Secrets Management**

- **Rationale:** Agents receive type-safe schema, not raw secrets, with runtime leak prevention and plugin architecture
- **Expected Benefits:** Design-time type safety, automatic leak prevention, multi-environment loading, framework integrations
- **Implementation Strategy:** Integrate Varlock patterns for schema-driven secrets validation and runtime leak scanning
- **ROI:** 3-5 months of building schema-driven security infrastructure

**Varlock Capabilities:**

```typescript
// Varlock schema-first integration
interface VarlockIntegration {
  // Schema-first approach
  schemaFirst: {
    design: 'Agents receive schema, never secrets';
    typesafety: 'Type-safe secret access patterns';
    runtime: 'Runtime validation and leak prevention';
  };

  // Plugin architecture
  plugins: {
    backends: 'Plugin architecture for secret backends';
    frameworks: 'Framework integrations (Next.js, Vite, Astro)';
    multiEnv: 'Multi-environment .env.* loading';
  };

  // Security features
  security: {
    leakScanning: 'Runtime leak scanning and prevention';
    validation: 'Schema-driven secret validation';
    runtime: 'Runtime leak prevention enhanced';
  };

  // Integration strategy
  integration: {
    complement: 'Complement existing @agentsy/secrets';
    enhance: 'Schema-driven validation and leak prevention';
    backwardsCompatible: 'Compatibility layer with current system';
  };
}
```

**Integration Priorities:**

1. **Schema Definition (Weeks 1-4):**
   - Define type-safe secret schemas for agents
   - Plugin architecture for secret backends
   - Multi-environment .env.\* loading

2. **Runtime Validation (Weeks 5-6):**
   - Schema-driven secret validation
   - Runtime leak scanning and prevention
   - Plugin architecture for backend extensibility

3. **Framework Integration (Weeks 7-8):**
   - Vite, Next.js, Astro integrations patterns
   - Development environment enhancements
   - Production deployment configuration

4. **Enhanced Security (Weeks 9-10):**
   - Runtime leak prevention enhanced
   - Schema-based permission management
   - Audit trail and compliance features

### Enhanced Security Architecture

```typescript
// Enhanced secrets with Varlock patterns
interface EnhancedSecretsArchitecture {
  // Schema-driven design
  schemaFirst: {
    definition: 'Type-safe secret schemas';
    access: 'Agents receive schema, not raw secrets';
    validation: 'Design-time and runtime validation';
  };

  // Multi-environment support
  environments: {
    loading: '.env.* multi-environment loading';
    validation: 'Per-environment schema validation';
    isolation: 'Environment-specific secret separation';
  };

  // Runtime protection
  runtime: {
    leakScanning: 'Runtime leak scanning and prevention';
    validation: 'Schema-driven validation';
    enforcement: 'Runtime leak prevention enhanced';
  };

  // Plugin extensibility
  plugins: {
    backends: 'Plugin architecture for secret backends';
    integrations: 'Framework and platform integrations';
    customization: 'Custom secret handling logic';
  };

  // Expected combined benefits
  benefits: {
    typesafety: 'Design-time type safety for all secrets';
    prevention: 'Automatic leak prevention via scanning';
    flexibility: 'Multi-environment and plugin support';
    integration: 'Comprehensive framework integrations';
  };
}
```

### Combined Benefits

**Security Enhancement:**

- **Typesafety:** Design-time type safety for all secret access
- **Leak prevention:** Automatic leak scanning and prevention
- **Validation:** Schema-driven validation at design and runtime
- **Runtime:** Enhanced runtime leak protection and prevention

**Operational Benefits:**

- **Multi-environment:** Flexible .env.\* loading and management
- **Extensibility:** Plugin architecture for custom backends
- **Integrations:** Ready-made framework integrations
- **Automation:** Automated secret validation and management

**Developer Experience:**

- **Type safety:** Type-safe secret access patterns
- **Debugging:** Clear schema constraints and validation
- **Flexibility:** Custom plugins and backend support
- **Compliance:** Built-in audit trail and compliance features

### Risk Mitigation

**Complexity:**

- **Risk:** Schema-first pattern adds complexity
- **Mitigation:** Compatibility layer with existing system, gradual migration

**Performance:**

- **Risk:** Runtime validation and scanning overhead
- **Mitigation:** Caching strategies, optimized scanning algorithms

**Integration:**

- **Risk:** Framework integration complexity
- **Mitigation:** Plugin architecture, pre-built integrations

### Integration Timeline

**Phase 1: Schema Foundation (Weeks 1-4)**

- Schema definition language implementation
- Plugin architecture foundation
- Multi-environment loading

**Phase 2: Runtime Protection (Weeks 5-8)**

- Runtime leak scanning and prevention
- Schema-driven validation
- Plugin implementation

**Phase 3: Integration & Polishing (Weeks 9-10)**

- Framework integrations
- Enhanced security features
- Compatibility layer and migration

---

## Architecture Decision Snapshot (migrated from `plan/DECISION-LOG.md`)

- `secrets` remains a standalone cross-cutting package and must not be merged into provider packages.
- Secret handling boundaries remain independent from provider/runtime feature work.
- Security-critical package boundaries are locked and validated in architecture verification gates.
