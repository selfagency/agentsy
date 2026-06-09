/**
 * Context injection audit trail.
 *
 * Records every context injection performed by a plugin so that security
 * reviews and forensic analysis can reconstruct what data was injected,
 * by which plugin version, and at which injection point — without storing
 * any raw content (only a SHA-256 content hash).
 *
 * @module @agentsy/plugins/audit
 */

import { createHash } from 'node:crypto';

/**
 * Where in the agent loop the context injection occurred.
 */
export type InjectionPoint = 'system_prompt' | 'user_message' | 'tool_result' | 'assistant_message';

/**
 * A single auditable record of a context injection event.
 */
export interface ContextInjectionRecord {
  /** SHA-256 hex digest of the injected content. Raw content is never stored. */
  readonly contentHash: string;
  /** Length (in characters) of the injected content. */
  readonly contentLength: number;
  /** Which part of the agent loop received the injected content. */
  readonly injectionPoint: InjectionPoint;
  /** The plugin that performed the injection. */
  readonly pluginId: string;
  /** Plugin version at the time of injection. */
  readonly pluginVersion: string;
  /** When the injection happened. */
  readonly timestamp: Date;
}

/**
 * Input descriptor for a single injection event.
 */
export interface ContextInjection {
  /** The raw content being injected (hashed, never stored directly). */
  readonly content: string;
  /** Which injection point received the content. */
  readonly point: InjectionPoint;
  /** The session-scoped identifier used to correlate audit trails. */
  readonly sessionId: string;
}

/**
 * Minimal plugin descriptor expected by the auditor.
 *
 * This is intentionally slimmer than a full plugin manifest so the
 * auditor has no hard coupling to any one manifest schema.
 */
export interface PluginDescriptor {
  readonly id: string;
  readonly version: string;
}

/**
 * Compute the SHA-256 hex digest of a string.
 */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Thread-safe auditor that records context injection events and
 * can replay the audit trail for a given session.
 *
 * Records are held in memory. For production durability, the caller
 * should persist records via an external store.
 */
export class ContextInjectionAuditor {
  readonly #recordsBySession = new Map<string, ContextInjectionRecord[]>();

  /**
   * Record a context injection event.
   *
   * @param plugin — Descriptor of the plugin performing the injection.
   * @param injection — Details about the injected content and injection point.
   */
  record(plugin: PluginDescriptor, injection: ContextInjection): void {
    const record: ContextInjectionRecord = {
      timestamp: new Date(),
      pluginId: plugin.id,
      pluginVersion: plugin.version,
      injectionPoint: injection.point,
      contentHash: sha256(injection.content),
      contentLength: injection.content.length
    };

    const existing = this.#recordsBySession.get(injection.sessionId);
    if (existing) {
      existing.push(record);
    } else {
      this.#recordsBySession.set(injection.sessionId, [record]);
    }
  }

  /**
   * Return every recorded injection event for the given session.
   *
   * @param sessionId — The session to filter by.
   * @returns An array of matching records, newest-first.
   */
  auditTrail(sessionId: string): ContextInjectionRecord[] {
    const records = this.#recordsBySession.get(sessionId);
    if (!records) {
      return [];
    }
    return records.slice().reverse();
  }

  /**
   * Return all records across every session (useful for batch auditing
   * or persistence).
   */
  allRecords(): ContextInjectionRecord[] {
    const all: ContextInjectionRecord[] = [];
    for (const records of this.#recordsBySession.values()) {
      all.push(...records);
    }
    return all;
  }
}
