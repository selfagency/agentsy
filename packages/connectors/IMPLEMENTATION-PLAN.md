# @agentsy/connectors — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/connectors` is the **gateway** of the framework. It allows Agentsy-powered agents to live and breathe on third-party communications platforms like Telegram, Discord, Slack, and Matrix. It handles the specific authentication, event listening, and message delivery requirements of each platform, presenting them as a unified "Channel" to the rest of the framework.

It integrates with `@agentsy/runtime` for message execution and `@agentsy/session` for conversation persistence across channel disconnects.

### Ecosystem Sketch

```text
[ User (Telegram/Slack) ]
           |
           v
[ @agentsy/connectors ] <--- Channel Adaptation
           |
    +------+------+
    |             |
    v             v
[ @agentsy/runtime ] [ @agentsy/session ]
(Agent Loop)         (Durable Chat)
```

## Fulfillment of Role

The package fulfills its role by providing:

1. **Channel Adapter Interface**: A standardized way to implement new platform integrations.
2. **First-party Adapters**: High-quality, production-ready implementations for popular platforms.
3. **Gateway Orchestration**: Managing multiple active adapters and routing inbound messages to the correct agent sessions.
4. **Security & Redaction**: Ensuring platform-specific credentials (bot tokens) are managed securely via `@agentsy/secrets`.

## Detailed Functionality

### 1. Adapter Registry (`src/adapters/`)

- **Mechanism**: Pluggable `ChannelAdapter` implementations.
- **Supported Channels**: Telegram, Discord, Slack, Matrix, Signal, WhatsApp, Feishu, Line, and SMTP/IMAP (Email).
- **Key Logic**: Platform-specific event parsing and challenge verification.
- **Unified Channel Interface**:

```typescript
export interface Channel {
  platform: string;
  connect(): Promise<void>;
  sendMessage(message: Message): Promise<void>;
  onMessage(handler: (msg: Message) => void): void;
}
```

### 2. Message Routing (`src/router/`)

- **Responsibility**: Association.
- **Functionality**: Maps a platform user ID and channel ID to a specific Agentsy `SessionId`.
- **Session Continuity**: Ensures that if a user switches from Slack to Telegram, their agent context can be optionally migrated or resumed.

### 3. Approval Integration (`src/approval/`)

- **Mechanism**: Inbound messages are treated as untrusted input and passed through the runtime's approval engine before triggering destructive tool calls.

## Logic & Data Flow

### 1. The Inbound Flow

1. A message arrives via a platform webhook (e.g., Telegram).
2. The `TelegramAdapter` parses the payload into a framework `InboundMessage`.
3. The `ConnectorGateway` identifies the `SessionId`.
4. The gateway calls `@agentsy/runtime` to process the message.
5. The runtime's response is streamed back to the `TelegramAdapter`, which sends it to the user.

## Key Interfaces

### ChannelAdapter

```typescript
export interface ChannelAdapter<TConfig> {
  id: string;
  type: string;
  onConnect(): Promise<void>;
  onDisconnect(): Promise<void>;
  onMessage(callback: (msg: InboundMessage) => Promise<void>): void;
  send(sessionId: SessionId, content: ContentPart[]): Promise<void>;
}
```

### ConnectorGateway

```typescript
export interface ConnectorGateway {
  registerAdapter(adapter: ChannelAdapter<unknown>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

## Implementation Details

### Security Hardening

Credentials like bot tokens must be loaded exclusively from environment variables or `@agentsy/runtime` secret store. No secrets should ever be hardcoded in adapter configuration objects.

### Webhook Reliability

The gateway must implement retry logic and idempotency checks (using platform-provided message IDs) to handle duplicate or dropped webhooks.

## Sources Synthesized

`agentsy-connectors-v1.md`, `agentsy-tech.md`, `DECISION-LOG.md`, `packages/connectors/IMPLEMENTATION-PLAN.md`.

---

## ConnectorGateway + Platform Adapters (Phase 8)

### Requirements

- **REQ-038**: `ConnectorGateway` routes inbound messages to agent loop sessions keyed by `channelId+userId`.
- **REQ-039**: Built-in commands `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage` handled before agent loop invocation.
- **REQ-040**: `AgentSessionManager` evicts idle sessions after `maxIdleTime` (default 1 hour) via `FileSystemSessionStore`.
- **REQ-041**: Platform SDKs (`grammy`, `discord.js`, `@slack/bolt`) are peerDependencies; gateway functions without any adapter installed.
- **REQ-042**: Built-in chat command handler runs before any slash command or agent loop invocation.
- **CON-010**: Platform SDKs are peerDependencies, never bundled. Each adapter file `import`s its peer at load time and throws a clear install message if missing.
- **GUD-010**: Adapters never directly reference orchestrator internals. Interaction with the agent loop is mediated through `ConnectorGateway`.
- **SEC-013**: All inbound messages are untrusted. Strip XML context-injection patterns via `stripXmlContextTags()` before any system prompt injection.
- **SEC-014**: Platform credentials (TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, SLACK_BOT_TOKEN, etc.) read exclusively from environment variables — never hardcoded.
- **RISK-013**: Platform SDK API changes may break adapters. Mitigation: peerDep version ranges pinned; adapters isolated in separate files.
- **RISK-016**: Discord bot intents misconfiguration causes silent message loss. Mitigation: adapter logs received intent mask on startup.
- **ASSUMPTION-012**: Each adapter runs in a single process per bot token; horizontal scaling requires external session storage.
- **ALT-009**: Rejected — embedding OpenClaw/NanoClaw inline. Rationale: out-of-scope for connector gateway; prefer `@agentsy/session` integration.
- **DEP-007**: `grammy@^1` — peerDep for TelegramAdapter
- **DEP-008**: `discord.js@^14` — peerDep for DiscordAdapter
- **DEP-009**: `@slack/bolt@^4` — peerDep for SlackAdapter

### Core Types (`src/types.ts`)

```ts
interface InboundMessage {
  channelId: string;
  userId: string;
  threadId?: string;
  text: string;
  attachments?: Attachment[];
  rawPayload: unknown;
}
interface OutboundMessage {
  channelId: string;
  userId: string;
  threadId?: string;
  text: string;
  attachments?: Attachment[];
}
interface ChannelAdapter<TConfig = unknown> {
  connect(config: TConfig): Promise<void>;
  disconnect(): Promise<void>;
  send(msg: OutboundMessage): Promise<void>;
  onMessage(handler: (msg: InboundMessage) => Promise<void>): void;
}
interface AgentSessionManagerOptions {
  maxIdleTime?: number;
  sessionStore?: SessionStore;
}
interface ConnectorGatewayOptions {
  adapters: ChannelAdapter[];
  sessionManager?: AgentSessionManagerOptions;
}
```

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TASK-F8-001 | Confirm `packages/connectors/` is a proper pnpm workspace package. peerDeps: `@agentsy/core@workspace:*`, `@agentsy/session@workspace:*`.                                                                                                              |
| TASK-F8-002 | Define types in `packages/connectors/src/types.ts`: `InboundMessage`, `OutboundMessage`, `Attachment`, `ChannelAdapter<TConfig>`, `SessionStore`, `AgentSessionManagerOptions`, `ConnectorGatewayOptions`, `BuiltInCommand`.                           |
| TASK-F8-003 | Implement `MessageRouter` in `packages/connectors/src/router.ts`. Route by `channelId+userId`. Sanitize via `stripXmlContextTags(text: string): string` (SEC-013). Detect built-in command prefix.                                                     |
| TASK-F8-004 | Implement `AgentSessionManager` in `packages/connectors/src/session-manager.ts`. Uses `@agentsy/session`. Keys sessions by `channelId+userId`. Evicts idle sessions after `maxIdleTime` (REQ-040). Default: 1 hour.                                    |
| TASK-F8-005 | Implement built-in chat command handler in `packages/connectors/src/commands.ts`. Commands: `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage` (REQ-039, REQ-042). Return `OutboundMessage` without invoking agent loop.          |
| TASK-F8-006 | Implement `ConnectorGateway` in `packages/connectors/src/gateway.ts`. Constructor accepts `ConnectorGatewayOptions`. Pipeline: `onMessage → stripXmlContextTags → built-in commands → slash commands → agent loop`. Export `createConnectorGateway()`. |
| TASK-F8-007 | `TelegramAdapter` in `packages/connectors/src/adapters/telegram.ts`. peerDep: `grammy@^1`. Env: `TELEGRAM_BOT_TOKEN`. Throw clear install error if grammy missing at load time.                                                                        |
| TASK-F8-008 | `DiscordAdapter` in `packages/connectors/src/adapters/discord.ts`. peerDep: `discord.js@^14`. Env: `DISCORD_BOT_TOKEN`. Log received intent mask on startup (RISK-016 mitigation).                                                                     |
| TASK-F8-009 | `SlackAdapter` in `packages/connectors/src/adapters/slack.ts`. peerDep: `@slack/bolt@^4`. Env: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`.                                                                                           |
| TASK-F8-010 | Export from `packages/connectors/src/index.ts`: `createConnectorGateway`, `TelegramAdapter`, `DiscordAdapter`, `SlackAdapter`, `MessageRouter`, `AgentSessionManager`, and all types.                                                                  |
| TASK-F8-011 | Gateway unit tests in `packages/connectors/src/gateway.test.ts`: routes to correct session, built-in commands bypass agent loop, XML injection in text field is stripped.                                                                              |
| TASK-F8-012 | Router unit tests in `packages/connectors/src/router.test.ts`: per-user session isolation, XML injection stripped (SEC-013), built-in command detection, thread ID propagation.                                                                        |

### Testing Requirements

- **TEST-007**: `gateway.test.ts` — per-user session isolation verified with concurrent message simulation
- **TEST-008**: `router.test.ts` — XML injection adversarial test: `<SYSTEM>inject</SYSTEM>` stripped from all field positions
- **TEST-010**: Adversarial: multi-channel concurrency, rapid session eviction under load

---

## Phase CN — Extended Channel Adapters

### Requirements

- **REQ-081**: `WhatsAppAdapter` uses WhatsApp Cloud API (`graph.facebook.com/v20.0/`) with `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN`.
- **REQ-082**: Enforce WhatsApp 24h customer-service window; otherwise require template message (`WhatsAppTemplateRequired`).
- **REQ-083**: `MatrixAdapter` supports hosted and self-hosted homeservers via `MATRIX_HOMESERVER_URL` + `MATRIX_ACCESS_TOKEN`, with invite-only room interaction.
- **REQ-084**: `MatrixAdapter` supports encrypted rooms via matrix-js-sdk Crypto + SQLite key store at `MATRIX_CRYPTO_STORE_PATH`.
- **REQ-085**: `TelegramAdapter` is optional, exported only via `@agentsy/connectors/telegram` deep import.
- **REQ-086**: `EmailAdapter` uses IMAP IDLE (no polling) with `IMAP_*` env vars.
- **REQ-087**: `EmailAdapter` sends via SMTP (`SMTP_*` env vars).
- **REQ-088**: `EmailAdapter` preserves threading through `Message-ID`, `In-Reply-To`, and `References` headers.
- **REQ-089**: Strip inbound HTML to plain text before forwarding.
- **REQ-090**: Export `createCustomAdapter<TConfig>(spec: CustomAdapterSpec<TConfig>)`.
- **SEC-019**: Reject WhatsApp webhooks with invalid `X-Hub-Signature-256` signature (HTTP 401).
- **SEC-020**: Enforce TLS for IMAP/SMTP unless `ALLOW_INSECURE_EMAIL=true`, emitting `InsecureEmailWarning`.
- **SEC-021**: Matrix room keys persist only in SQLite crypto store.
- **CON-016**: Adapter SDKs are peer deps.
- **CON-017**: Telegram deep import only.
- **CON-018**: IMAP IDLE required, no polling.

### Phase CN1 — WhatsApp + Matrix

| Task         | Description                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| TASK-CN1-001 | Add WhatsApp Cloud API REST client wiring and env var docs.                            |
| TASK-CN1-002 | Implement `src/adapters/whatsapp.ts` with HMAC verification and plain-text extraction. |
| TASK-CN1-003 | Implement 24h WhatsApp template guard.                                                 |
| TASK-CN1-004 | Add `matrix-js-sdk@^35` as peer dep.                                                   |
| TASK-CN1-005 | Implement `src/adapters/matrix.ts` with auto-join on invite and timeline listener.     |
| TASK-CN1-006 | Add E2E crypto initialization with SQLite store path config.                           |
| TASK-CN1-007 | Export `WhatsAppAdapter` and `MatrixAdapter` from barrel.                              |
| TASK-CN1-008 | Add `whatsapp.test.ts` for HMAC/template/sanitization cases.                           |
| TASK-CN1-009 | Add `matrix.test.ts` for invite/E2E/sanitization cases.                                |

### Phase CN2 — Telegram (Optional)

| Task         | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| TASK-CN2-001 | Add `grammy@^1` peer dep + `./telegram` export mapping.         |
| TASK-CN2-002 | Implement `src/adapters/telegram.ts` with env-based token auth. |
| TASK-CN2-003 | Keep Telegram out of main barrel export.                        |
| TASK-CN2-004 | Add `telegram.test.ts` for send/delegation/token error cases.   |

### Phase CN3 — Email (IMAP/SMTP)

| Task         | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| TASK-CN3-001 | Add `imapflow`, `nodemailer`, `mailparser` as peer deps.     |
| TASK-CN3-002 | Implement `src/adapters/email.ts` with TLS enforcement.      |
| TASK-CN3-003 | Implement IMAP IDLE loop + HTML strip + metadata extraction. |
| TASK-CN3-004 | Implement thread state tracking and header propagation.      |
| TASK-CN3-005 | Implement SMTP send with thread headers.                     |
| TASK-CN3-006 | Export email adapter types from barrel.                      |
| TASK-CN3-007 | Add `email.test.ts` for threading/TLS/sanitization.          |

### Phase CN4 — Custom Adapter Factory

| Task         | Description                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| TASK-CN4-001 | Finalize JSDoc for `ChannelAdapter<TConfig>`.                                         |
| TASK-CN4-002 | Implement `src/custom.ts` `createCustomAdapter<TConfig>()` with inbound sanitization. |
| TASK-CN4-003 | Export `createCustomAdapter` and `CustomAdapterSpec`.                                 |
| TASK-CN4-004 | Add `custom.test.ts` for delegation + sanitization behavior.                          |
| TASK-CN4-005 | Add `docs/developers/custom-connector.md` and nav link.                               |

### Additional Dependencies

- **DEP-017**: `matrix-js-sdk@^35`
- **DEP-018**: `grammy@^1`
- **DEP-019**: `imapflow@^1`
- **DEP-020**: `nodemailer@^6`
- **DEP-021**: `mailparser@^3`
- **DEP-022**: WhatsApp Cloud API (REST)

### Additional Tests

- **TEST-CN-001**: `whatsapp.test.ts` — signature + 24h template + sanitization.
- **TEST-CN-002**: `matrix.test.ts` — invite, encryption bootstrap, sanitization.
- **TEST-CN-003**: `telegram.test.ts` — grammY delegation, missing token path.
- **TEST-CN-004**: `email.test.ts` — IMAP IDLE, threading headers, TLS enforcement.
- **TEST-CN-005**: `custom.test.ts` — interface conformance + inbound sanitization.

---

## Scheduler Delivery Integration (from `plan/agentsy-scheduler-v1.md`)

When scheduled tasks complete, connectors handle result delivery using seamless handoff:

- If originating session is active, inject result as proactive message.
- If inactive, queue delivery and flush on next session resume.

### Delivery requirements

- Scheduled task result delivery uses existing `ChannelAdapter.send()`.
- Delivery keyed by `task.deliveryChannel` and `ownerId`.
- Preserve thread/room context where adapter supports it (`threadId`, channel message metadata).

### Security

- Scheduler-delivered content is treated as untrusted output for connector transport; keep existing sanitization and channel-safe formatting guards.

### Tests

- Active session path: immediate `send()`.
- Inactive session path: queued then flushed on resume.
- No duplicate delivery on resume replays.

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Connector gateway contracts

```typescript
interface ConnectorGateway {
  addAdapter(adapter: ChannelAdapter): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface AgentSessionManager {
  getOrCreateSession(message: InboundMessage): Promise<AgentSession>;
  terminateSession(conversationId: string): Promise<void>;
}
```

### Security and runtime boundaries

- Inbound payloads remain untrusted and sanitized before loop injection.
- Platform SDKs remain peer dependencies.
- Connector package remains channel/gateway focused; core agent execution remains in orchestrator/runtime.
