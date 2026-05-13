# @agentsy/secrets — Implementation Plan

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

## Architecture Decision Snapshot (migrated from `plan/DECISION-LOG.md`)

- `secrets` remains a standalone cross-cutting package and must not be merged into provider packages.
- Secret handling boundaries remain independent from provider/runtime feature work.
- Security-critical package boundaries are locked and validated in architecture verification gates.
