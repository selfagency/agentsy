import { createHash } from 'node:crypto';

export type AuditOperation = 'read' | 'write' | 'delete' | 'snapshot' | 'restore';

const SECRET_PATTERN = /(?:key|token|secret|password|credential|auth)[^\s]*\s*[:=]\s*\S+/gi;

function redactSecrets(value: string): string {
  return value.replace(SECRET_PATTERN, '[REDACTED]');
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
  const seq = (++counter).toString(36).padStart(4, '0');
  const rand = createHash('sha256').update(`${ts}${seq}${Math.random()}`).digest('hex').slice(0, 8);
  return `${ts}-${seq}-${rand}`;
}

export function createAuditTrail(): AuditTrail {
  const events: AuditEvent[] = [];

  return {
    record(operation, path, options) {
      const event: AuditEvent = {
        id: generateId(),
        correlationId: options?.correlationId ?? generateId(),
        operation,
        path: redactSecrets(path),
        ...(options?.contentHash !== undefined ? { contentHash: options.contentHash } : {}),
        ...(options?.actor !== undefined ? { actor: options.actor } : {}),
        timestamp: Date.now(),
        ...(options?.metadata !== undefined ? { metadata: options.metadata } : {})
      };
      events.push(event);
      return event;
    },

    query(path) {
      if (path === undefined) return [...events];
      return events.filter(e => e.path === path);
    },

    byCorrelation(correlationId) {
      return events.filter(e => e.correlationId === correlationId);
    },

    clear() {
      events.length = 0;
    }
  };
}
