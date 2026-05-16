import { createHash, randomBytes } from "node:crypto";

export type AuditOperation =
  | "read"
  | "write"
  | "delete"
  | "snapshot"
  | "restore";

/**
 * Pattern for identifying secrets in strings (e.g., config values, command output).
 * Matches patterns like 'api_token: sk-123' or 'apiKey = abc'.
 * Uses a negative lookbehind (or alternative approach since lookbehind support varies)
 * to avoid matching common file or list names like 'author-list' or 'key-count'.
 */
const SECRET_PATTERN =
  /\b(?:api[_-]?)?(?:token|secret|password|credential|auth|key)(?![_-])\s*[:=]\s*\S+/gi;

function redactSecrets(value: string): string {
  return value.replace(SECRET_PATTERN, "[REDACTED]");
}

export interface AuditEvent {
  readonly id: string;
  readonly correlationId: string;
  readonly operation: AuditOperation;
  readonly path: string;
  readonly contentHash?: string;
  readonly actor?: string;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface AuditTrail {
  record(
    operation: AuditOperation,
    path: string,
    options?: {
      correlationId?: string;
      contentHash?: string;
      actor?: string;
      metadata?: Record<string, string>;
    }
  ): AuditEvent;
  query(path?: string): AuditEvent[];
  byCorrelation(correlationId: string): AuditEvent[];
  clear(): void;
}

let counter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  const seq = (++counter).toString(36).padStart(4, "0");
  const rand = createHash("sha256")
    .update(`${ts}${seq}${randomBytes(16).toString("hex")}`)
    .digest("hex")
    .slice(0, 8);
  return `${ts}-${seq}-${rand}`;
}

export function createAuditTrail(): AuditTrail {
  const events: AuditEvent[] = [];

  return {
    byCorrelation(correlationId) {
      return events.filter((e) => e.correlationId === correlationId);
    },

    clear() {
      events.length = 0;
    },

    query(path) {
      if (path === undefined) {
        return [...events];
      }
      return events.filter((e) => e.path === path);
    },

    record(operation, path, options) {
      const event: AuditEvent = {
        id: generateId(),
        correlationId: options?.correlationId ?? generateId(),
        operation,
        path: redactSecrets(path),
        ...(options?.contentHash === undefined
          ? {}
          : { contentHash: options.contentHash }),
        ...(options?.actor === undefined ? {} : { actor: options.actor }),
        timestamp: Date.now(),
        ...(options?.metadata === undefined
          ? {}
          : { metadata: options.metadata }),
      };
      events.push(event);
      return event;
    },
  };
}
