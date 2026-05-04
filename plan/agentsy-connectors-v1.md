---
goal: '@agentsy/connectors — extended channel adapters: Signal, WhatsApp, Matrix, Telegram, IMAP/SMTP email, custom adapter interface'
version: '1.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['feature', 'connectors', 'signal', 'whatsapp', 'matrix', 'telegram', 'email', 'agentsy']
---

# @agentsy Platform — Extended Connectors v1

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Extends the `@agentsy/connectors` package defined in `agentsy-features-v1.md` Phase 8. That plan ships the `ConnectorGateway` core (`MessageRouter`, `AgentSessionManager`, `AdapterRegistry`) and three first-party adapters: `SignalAdapter`, `DiscordAdapter`, `SlackAdapter`. This plan adds:

1. **WhatsApp** — via WhatsApp Cloud API (Meta Business)
2. **Matrix** — self-hosted or matrix.org homeserver via matrix-js-sdk
3. **Telegram** — via grammY (lower priority than Signal; opt-in)
4. **IMAP/SMTP email** — inbound via IMAP IDLE, outbound via SMTP, thread-aware
5. **Custom adapter interface** — documented `ChannelAdapter<TConfig>` contract + scaffolding helper for consumer-built adapters

All adapters implement the `ChannelAdapter` interface from Phase 8. All credentials are env-var only (SEC-014). All inbound payloads pass through `stripXmlContextTags` / `dedupeXmlContext` before forwarding (SEC-013).

Existing REQ/SEC/CON/ADR identifiers are preserved.

---

## 1. Requirements & Constraints

- **REQ-081**: `WhatsAppAdapter` MUST use the WhatsApp Cloud API (Meta Business, `graph.facebook.com/v20.0/`). Authentication via `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` env vars. Webhook verification MUST validate `X-Hub-Signature-256` HMAC-SHA256 against `WHATSAPP_VERIFY_TOKEN`.
- **REQ-082**: `WhatsAppAdapter` MUST handle template message requirements for first-contact messages (WhatsApp Cloud API restriction). After user-initiated contact, free-form text messages are permitted within the 24-hour customer service window.
- **REQ-083**: `MatrixAdapter` MUST support both hosted (matrix.org) and self-hosted homeservers. Config: `homeserverUrl`, `accessToken` from `MATRIX_HOMESERVER_URL` + `MATRIX_ACCESS_TOKEN` env vars. MUST join rooms on invite and respond only in rooms the bot has been explicitly invited to.
- **REQ-084**: `MatrixAdapter` MUST support end-to-end encryption via matrix-js-sdk's Crypto module when the room has encryption enabled. Keys MUST be stored in a local SQLite file (path configurable via `MATRIX_CRYPTO_STORE_PATH`).
- **REQ-085**: `TelegramAdapter` MUST be implemented as an optional adapter (package entrypoint: `@agentsy/connectors/telegram`). It is NOT included in the main `@agentsy/connectors` barrel export. Peer dep: `grammy@^1`.
- **REQ-086**: `EmailAdapter` MUST connect to an IMAP server using IMAP IDLE for real-time inbound message delivery (no polling). Config: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_MAILBOX` (default: `INBOX`) env vars.
- **REQ-087**: `EmailAdapter` MUST send outbound messages via SMTP using `nodemailer`. Config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` env vars.
- **REQ-088**: `EmailAdapter` MUST maintain thread continuity by tracking `Message-ID` and `In-Reply-To` / `References` headers. Each reply MUST be sent in-thread with the correct `In-Reply-To` header. Thread ID MUST be stored in `AgentSessionManager` per `channelId+userId`.
- **REQ-089**: `EmailAdapter` MUST strip HTML from inbound messages before forwarding to the agent (plain text only). Outbound messages MAY be sent as `text/plain` + optional `text/html` multipart. HTML generation is out of scope for v1.
- **REQ-090**: `createCustomAdapter<TConfig>(spec: CustomAdapterSpec<TConfig>): ChannelAdapter<TConfig>` MUST be exported from `@agentsy/connectors` to enable consumers to build adapters without implementing the full interface from scratch. `CustomAdapterSpec` provides typed hooks: `onConnect`, `onDisconnect`, `onMessage`, `send`.
- **SEC-019**: `WhatsAppAdapter` MUST verify `X-Hub-Signature-256` on every inbound webhook. Requests without a valid signature MUST be rejected with HTTP 401 before any message processing.
- **SEC-020**: `EmailAdapter` MUST enforce TLS for both IMAP and SMTP connections. Plain-text connections MUST be rejected unless `ALLOW_INSECURE_EMAIL=true` is explicitly set (emits `InsecureEmailWarning` event on startup).
- **SEC-021**: `MatrixAdapter` encrypted room keys MUST NOT be stored in memory beyond the current session. SQLite crypto store MUST be the only persistence mechanism.
- **CON-016**: All new adapters MUST list their platform SDK as a `peerDependency`. The main `@agentsy/connectors` barrel MUST NOT hard-depend on any platform SDK.
- **CON-017**: `TelegramAdapter` is exported from a separate deep-import path (`@agentsy/connectors/telegram`) to avoid bundling grammY for users who don't need it.
- **CON-018**: `EmailAdapter` MUST NOT use polling. IMAP IDLE is required for real-time delivery.

---

## 2. Implementation Steps

### Phase CN1 — WhatsApp + Matrix Adapters

- **GOAL-CN1**: Ship `WhatsAppAdapter` and `MatrixAdapter` as first-class adapters in `packages/connectors/`.

| Task         | Description                                                                                                                                                                                                                                                                                                                                          | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CN1-001 | Add `@whatsapp-cloud-api` or raw `fetch`-based WhatsApp Cloud API client (no SDK needed — REST only) to `packages/connectors/package.json` as optional dep. Add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` to env var docs.                                                                                        |           |      |
| TASK-CN1-002 | Implement `WhatsAppAdapter` in `packages/connectors/src/adapters/whatsapp.ts`. Implements `ChannelAdapter`. `connect()` registers webhook endpoint. `onMessage` handler validates `X-Hub-Signature-256` (SEC-019) — reject with 401 on failure. Strips inbound payload to plain text before emitting `InboundMessage`.                               |           |      |
| TASK-CN1-003 | Implement WhatsApp template guard in `WhatsAppAdapter`: track last-inbound-message timestamp per `userId`. If >24h elapsed since last inbound message from user, `send()` MUST throw `WhatsAppTemplateRequired` error with message: consumer must send a pre-approved template first.                                                                |           |      |
| TASK-CN1-004 | Add `matrix-js-sdk@^35` as `peerDependency` in `packages/connectors/package.json`.                                                                                                                                                                                                                                                                   |           |      |
| TASK-CN1-005 | Implement `MatrixAdapter` in `packages/connectors/src/adapters/matrix.ts`. Config: `{ homeserverUrl, accessToken }` from `MATRIX_HOMESERVER_URL` + `MATRIX_ACCESS_TOKEN`. `connect()` starts matrix-js-sdk client, registers `RoomMemberEvent.Membership` listener to auto-join on invite, registers `RoomEvent.Timeline` listener for new messages. |           |      |
| TASK-CN1-006 | Implement E2E encryption in `MatrixAdapter`: on startup check if `@agentsy/runtime` crypto store path is configured (`MATRIX_CRYPTO_STORE_PATH`). Initialize matrix-js-sdk Crypto with SQLite store. For encrypted rooms, decrypt inbound events before forwarding. Encrypt outbound messages before sending (SEC-021).                              |           |      |
| TASK-CN1-007 | Export `WhatsAppAdapter`, `MatrixAdapter` from `packages/connectors/src/index.ts` barrel alongside existing `TelegramAdapter`, `DiscordAdapter`, `SlackAdapter`.                                                                                                                                                                                     |           |      |
| TASK-CN1-008 | Write unit tests in `packages/connectors/src/adapters/whatsapp.test.ts`. Cases: valid HMAC signature passes; invalid signature returns 401 (SEC-019); template guard throws after 24h; plain-text extraction from WhatsApp payload; sanitization of XML injection in message text (SEC-013).                                                         |           |      |
| TASK-CN1-009 | Write unit tests in `packages/connectors/src/adapters/matrix.test.ts`. Cases: auto-join on invite event; ignores messages from rooms not joined via invite; plaintext sent when no encryption; encrypted room triggers Crypto module init; message text passes through sanitization pipeline.                                                        |           |      |

### Phase CN2 — Telegram Adapter (Optional)

- **GOAL-CN2**: Ship `TelegramAdapter` as a separately importable adapter that doesn't bloat the main bundle.

| Task         | Description                                                                                                                                                                                                                                                   | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CN2-001 | Add `grammy@^1` as `peerDependency` in `packages/connectors/package.json`. Add `exports` entry in `package.json`: `"./telegram": "./dist/adapters/telegram.js"` (CON-017).                                                                                    |           |      |
| TASK-CN2-002 | Implement `TelegramAdapter` in `packages/connectors/src/adapters/telegram.ts`. Config: `{ botToken }` from `TELEGRAM_BOT_TOKEN` env var (SEC-014). Implements `ChannelAdapter`. `connect()` starts grammY Bot instance. `send()` calls `bot.api.sendMessage`. |           |      |
| TASK-CN2-003 | Do NOT re-export `TelegramAdapter` from `packages/connectors/src/index.ts` main barrel. It is only available via `@agentsy/connectors/telegram` deep import (CON-017).                                                                                        |           |      |
| TASK-CN2-004 | Write unit tests in `packages/connectors/src/adapters/telegram.test.ts`. Cases: `send()` calls correct grammY API method; inbound message emitted as `InboundMessage`; credentials loaded from env (SEC-014 — test throws if `TELEGRAM_BOT_TOKEN` not set).   |           |      |

### Phase CN3 — Email Adapter (IMAP/SMTP)

- **GOAL-CN3**: Ship `EmailAdapter` with IMAP IDLE inbound + SMTP outbound, thread-aware reply tracking.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                                                   | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CN3-001 | Add `imapflow@^1` (IMAP IDLE client) and `nodemailer@^6` (SMTP) as `peerDependencies` in `packages/connectors/package.json`. Add `mailparser@^3` for HTML stripping.                                                                                                                                                                                                                                          |           |      |
| TASK-CN3-002 | Implement `EmailAdapter` in `packages/connectors/src/adapters/email.ts`. Config: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_MAILBOX`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` from env (SEC-014, SEC-020). `connect()` opens IMAP connection with TLS required — reject plain-text unless `ALLOW_INSECURE_EMAIL=true` (SEC-020, emits `InsecureEmailWarning`). |           |      |
| TASK-CN3-003 | Implement IMAP IDLE loop in `EmailAdapter.connect()`: use `imapflow` `idle()` method (CON-018 — no polling). On new message: fetch full message, parse with `mailparser`, strip HTML to plain text (REQ-089), extract `From`, `Subject`, `Message-ID`, `In-Reply-To`. Emit `InboundMessage` with `channelId: 'email'`, `userId: fromAddress`, `threadId: rootMessageId`.                                      |           |      |
| TASK-CN3-004 | Implement thread tracking in `EmailAdapter`: maintain `Map<userId, { lastMessageId, references }>` in memory, persisted to `AgentSessionManager` metadata. `send()` builds correct `In-Reply-To` + `References` headers from stored thread state (REQ-088).                                                                                                                                                   |           |      |
| TASK-CN3-005 | Implement `EmailAdapter.send()` via `nodemailer` transporter. Outbound message: `text/plain` body. Include `In-Reply-To` + `References` headers from thread state. TLS required (SEC-020).                                                                                                                                                                                                                    |           |      |
| TASK-CN3-006 | Export `EmailAdapter` from `packages/connectors/src/index.ts`. Export `EmailAdapterOptions`, `EmailThreadState` types.                                                                                                                                                                                                                                                                                        |           |      |
| TASK-CN3-007 | Write unit tests in `packages/connectors/src/adapters/email.test.ts`. Mock `imapflow` and `nodemailer`. Cases: HTML stripped from inbound; `In-Reply-To` header set correctly on reply; thread ID persists across two turns; plain-text IMAP rejected without `ALLOW_INSECURE_EMAIL` (SEC-020); XML injection in subject/body stripped (SEC-013).                                                             |           |      |

### Phase CN4 — Custom Adapter Interface + Scaffolding

- **GOAL-CN4**: Formalize `ChannelAdapter<TConfig>` as a documented public interface and ship `createCustomAdapter` factory helper.

| Task         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                            | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-CN4-001 | Ensure `ChannelAdapter<TConfig>` in `packages/connectors/src/types.ts` is fully documented with JSDoc. Interface: `connect(): Promise<void>`, `disconnect(): Promise<void>`, `send(msg: OutboundMessage): Promise<void>`, `onMessage(handler: (msg: InboundMessage) => void): void`.                                                                                                                                                                   |           |      |
| TASK-CN4-002 | Implement `createCustomAdapter<TConfig>(spec: CustomAdapterSpec<TConfig>): ChannelAdapter<TConfig>` in `packages/connectors/src/custom.ts`. `CustomAdapterSpec`: `{ name: string, connect(config: TConfig): Promise<void>, disconnect(): Promise<void>, send(msg: OutboundMessage, config: TConfig): Promise<void>, onMessage(handler): void }`. Validates that inbound messages are passed through `stripXmlContextTags` before forwarding (SEC-013). |           |      |
| TASK-CN4-003 | Export `createCustomAdapter`, `CustomAdapterSpec` from `packages/connectors/src/index.ts`.                                                                                                                                                                                                                                                                                                                                                             |           |      |
| TASK-CN4-004 | Write unit tests in `packages/connectors/src/custom.test.ts`. Cases: returned adapter implements `ChannelAdapter` shape; `onMessage` handler receives sanitized text; `connect`/`disconnect`/`send` delegate to spec functions; XML injection in `send` output is NOT sanitized (outbound is trusted content).                                                                                                                                         |           |      |
| TASK-CN4-005 | Add `docs/developers/custom-connector.md` documenting `createCustomAdapter` with a minimal working example (e.g., a fake "in-process" adapter for testing). Link from `docs/developers/index.md`.                                                                                                                                                                                                                                                      |           |      |

---

## 3. Alternatives

- **ALT-016**: Use Matrix as the only E2E encrypted adapter (skip Telegram). Accepted — Telegram is opt-in via deep import (CON-017); Signal is the primary E2E choice from Phase 8.
- **ALT-017**: Use Nodemailer for both IMAP and SMTP. Rejected for IMAP — nodemailer is send-only; `imapflow` is the maintained modern IMAP library with IDLE support.
- **ALT-018**: Use polling for IMAP inbound. Rejected — violates CON-018; IMAP IDLE delivers messages within seconds without the 60-second polling latency.
- **ALT-019**: WhatsApp via Twilio or third-party wrapper. Rejected — adds a paid intermediary; Meta Cloud API is free and gives direct webhook delivery.

---

## 4. Dependencies

- **DEP-017**: `matrix-js-sdk@^35` — Matrix adapter. `peerDependency` in `packages/connectors/package.json`.
- **DEP-018**: `grammy@^1` — Telegram adapter. `peerDependency` in `packages/connectors/package.json`.
- **DEP-019**: `imapflow@^1` — IMAP IDLE for `EmailAdapter`. `peerDependency`.
- **DEP-020**: `nodemailer@^6` — SMTP for `EmailAdapter`. `peerDependency`.
- **DEP-021**: `mailparser@^3` — HTML stripping for inbound email. `peerDependency`.
- **DEP-022**: WhatsApp Cloud API — REST-only, no SDK; authenticated via `WHATSAPP_ACCESS_TOKEN`.

---

## 5. Files

- **FILE-033**: `packages/connectors/src/adapters/whatsapp.ts` — `WhatsAppAdapter`
- **FILE-034**: `packages/connectors/src/adapters/matrix.ts` — `MatrixAdapter`
- **FILE-035**: `packages/connectors/src/adapters/telegram.ts` — `TelegramAdapter` (deep import only)
- **FILE-036**: `packages/connectors/src/adapters/email.ts` — `EmailAdapter`
- **FILE-037**: `packages/connectors/src/custom.ts` — `createCustomAdapter`
- **FILE-038**: `docs/developers/custom-connector.md` — custom adapter documentation

---

## 6. Testing

- **TEST-CN-001**: `whatsapp.test.ts` — HMAC validation (SEC-019), 24h template guard, XML sanitization
- **TEST-CN-002**: `matrix.test.ts` — invite auto-join, E2E crypto init, message sanitization
- **TEST-CN-003**: `telegram.test.ts` — grammY delegation, missing token error
- **TEST-CN-004**: `email.test.ts` — IMAP IDLE, HTML strip, thread `In-Reply-To`, TLS enforcement (SEC-020)
- **TEST-CN-005**: `custom.test.ts` — `ChannelAdapter` shape, sanitization of inbound

---

## 7. Risks & Assumptions

- **RISK-CN-001**: WhatsApp Cloud API webhook requires a public HTTPS endpoint. In development this means using a tunnel (ngrok, cloudflare tunnel). Mitigation: document in adapter README; no code change needed.
- **RISK-CN-002**: Matrix E2E key recovery after pod restart requires persistent SQLite store. If `MATRIX_CRYPTO_STORE_PATH` is in an ephemeral container volume, keys are lost. Mitigation: document that `MATRIX_CRYPTO_STORE_PATH` MUST point to persistent storage in production.
- **RISK-CN-003**: `imapflow` IDLE connection drops silently on some servers. Mitigation: `EmailAdapter` MUST implement reconnect-on-error with exponential backoff (max 5 retries, emit `ImapReconnecting` event).
- **ASSUMPTION-CN-001**: Phase 8 `ConnectorGateway` core (`MessageRouter`, `AgentSessionManager`, `ChannelAdapter` interface) from `agentsy-features-v1.md` is implemented before this plan begins.

---

## 8. Related Specifications / Further Reading

- [agentsy-features-v1.md](agentsy-features-v1.md) — Phase 8 (ConnectorGateway core, SignalAdapter, DiscordAdapter, SlackAdapter)
- [WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
- [imapflow](https://imapflow.com/)
- [nodemailer](https://nodemailer.com/)
