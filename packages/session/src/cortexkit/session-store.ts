import type { Database } from 'better-sqlite3';
import type { LegacySessionState, SessionStore } from '../store.js';

const SESSION_PREFIX = 'session_value:';

/**
 * Create a session store backed by Magic Context's SQLite database.
 *
 * Values are stored as JSON blobs in MC's `session_meta` key-value table.
 *
 * @param sessionId - Unique session identifier
 * @param db - MC database connection
 */
export function createCortexKitSessionStore(sessionId: string, db: Database): SessionStore {
  function getMetaValue(key: string): string | undefined {
    const row = db
      .prepare('SELECT value FROM session_meta WHERE session_id = ? AND key = ?')
      .get(sessionId, `${SESSION_PREFIX}${key}`) as { value: string } | undefined;
    return row?.value;
  }

  function setMetaValue(key: string, value: string): void {
    db.prepare(
      `INSERT INTO session_meta (session_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id, key) DO UPDATE SET value = excluded.value`
    ).run(sessionId, `${SESSION_PREFIX}${key}`, value);
  }

  function deleteMetaValue(key: string): void {
    db.prepare('DELETE FROM session_meta WHERE session_id = ? AND key = ?').run(sessionId, `${SESSION_PREFIX}${key}`);
  }

  function getAllKeys(): string[] {
    const rows = db
      .prepare('SELECT key FROM session_meta WHERE session_id = ? AND key LIKE ?')
      .all(sessionId, `${SESSION_PREFIX}%`) as { key: string }[];
    return rows.map(r => r.key.slice(SESSION_PREFIX.length));
  }

  return {
    clear() {
      db.prepare('DELETE FROM session_meta WHERE session_id = ? AND key LIKE ?').run(sessionId, `${SESSION_PREFIX}%`);
    },

    getState(): LegacySessionState {
      const values: Record<string, unknown> = Object.create(null);
      const keys = getAllKeys();
      for (const key of keys) {
        const raw = getMetaValue(key);
        if (raw !== undefined) {
          try {
            Reflect.set(values, key, JSON.parse(raw) as unknown);
          } catch {
            Reflect.set(values, key, raw);
          }
        }
      }
      return { id: sessionId, values };
    },

    getValue<T = unknown>(key: string): T | undefined {
      const raw = getMetaValue(key);
      if (raw === undefined) {
        return;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    },

    listKeys(): string[] {
      return getAllKeys();
    },

    removeValue(key: string): void {
      deleteMetaValue(key);
    },

    setValue(key: string, value: unknown): void {
      setMetaValue(key, JSON.stringify(value));
    }
  };
}
