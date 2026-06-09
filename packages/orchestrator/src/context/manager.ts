import { randomUUID } from 'node:crypto';

/** Default TTL for context frames (30 minutes). */
const DEFAULT_FRAME_TTL_MS = 30 * 60 * 1000;

/** Default TTL for resource locks (30 seconds). */
const DEFAULT_LOCK_TTL_MS = 30_000;

/**
 * Represents an isolated context frame scoped to a single agent's execution.
 * Frames control what fields an agent can observe and what resources it has locked.
 */
export interface ContextFrame {
  /** Agent that owns this frame. */
  agentId: string;
  /** When this frame expires and can be garbage-collected. */
  expiry: Date;
  /** Unique identifier for this frame. */
  frameId: string;
  /** Resources that have been locked through this frame's agent. */
  lockedResources: string[];
  /** Arbitrary metadata keys and values scoped to this frame. */
  metadata: Record<string, unknown>;
  /** Optional parent agent in delegation chains. */
  parentAgentId?: string;
  /** Session this frame belongs to. */
  sessionId: string;
  /** Field names this agent is allowed to observe. */
  visibleFields: string[];
}

/**
 * Represents an exclusive lock on a named resource.
 * Agents must hold a lock before mutating shared state.
 */
export interface LockToken {
  /** When the lock was acquired. */
  acquiredAt: Date;
  /** When the lock expires and can be reclaimed. */
  expiresAt: Date;
  /** Agent ID currently holding the lock. */
  heldBy: string;
  /** Resource identifier (e.g. config key, file path, state variable). */
  resource: string;
  /** Time-to-live in milliseconds at acquisition time. */
  ttlMs: number;
}

/**
 * Manages context isolation and resource locking for multi-agent orchestration.
 *
 * - Creates isolated context frames per agent with explicit field visibility
 * - Provides exclusive resource locking to prevent concurrent mutations
 * - Automatically garbage-collects expired frames and locks via cleanup()
 */
export class ContextManager {
  private readonly frames: Map<string, ContextFrame> = new Map();
  private readonly locks: Map<string, LockToken> = new Map();

  /**
   * Creates a new isolated context frame for an agent.
   * Only fields declared in `visibleFields` will be observable.
   *
   * @param frame - Frame data (frameId and expiry are auto-generated).
   * @returns The created ContextFrame.
   */
  pushContext(frame: Omit<ContextFrame, 'frameId' | 'expiry'>): ContextFrame {
    this.validatePushContext(frame);

    const newFrame: ContextFrame = {
      ...frame,
      frameId: randomUUID(),
      expiry: new Date(Date.now() + DEFAULT_FRAME_TTL_MS)
    };

    this.frames.set(newFrame.frameId, newFrame);
    return newFrame;
  }

  /**
   * Removes a context frame and releases all locks held by its agent.
   *
   * @param frameId - ID of the frame to pop.
   * @throws If `frameId` does not exist.
   */
  popContext(frameId: string): void {
    const frame = this.frames.get(frameId);
    if (!frame) {
      throw new Error(`ContextFrame "${frameId}" not found`);
    }

    // Release all locks held by this frame's agent
    for (const [resource, lock] of this.locks) {
      if (lock.heldBy === frame.agentId) {
        this.locks.delete(resource);
      }
    }

    this.frames.delete(frameId);
  }

  /**
   * Returns the merged visible context for an agent across all its frames.
   * Later frames override earlier ones when field names conflict.
   *
   * @param agentId - Agent whose visible context to retrieve.
   * @returns A record of field names to values the agent may observe.
   */
  getVisibleContext(agentId: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Frames are iterated in insertion order; later values override (top frame wins).
    for (const frame of this.frames.values()) {
      if (frame.agentId !== agentId) {
        continue;
      }

      const visible = Object.fromEntries(
        Object.entries(frame.metadata).filter(([k]) => frame.visibleFields.includes(k))
      );
      Object.assign(result, visible);
    }

    return result;
  }

  /**
   * Acquires an exclusive lock on a resource for an agent.
   *
   * - If the same agent already holds the lock, its expiry is extended.
   * - If a different agent holds a non-expired lock, acquisition is rejected.
   * - Expired locks are automatically reclaimed.
   *
   * @param resource - Resource to lock.
   * @param agentId - Agent requesting the lock.
   * @param ttlMs - Lock TTL in milliseconds (default: 30000).
   * @returns The LockToken for the acquired lock.
   * @throws If the resource is locked by a different agent.
   */
  acquireLock(resource: string, agentId: string, ttlMs: number = DEFAULT_LOCK_TTL_MS): LockToken {
    const now = Date.now();
    const existing = this.locks.get(resource);

    if (existing) {
      // Auto-expire stale locks
      if (existing.expiresAt <= new Date(now)) {
        this.locks.delete(resource);
      } else if (existing.heldBy === agentId) {
        // Same agent: extend expiry
        existing.expiresAt = new Date(now + ttlMs);
        return existing;
      } else {
        // Different agent holds a valid lock
        throw new Error(`Resource "${resource}" is already locked by agent "${existing.heldBy}"`);
      }
    }

    const token: LockToken = {
      resource,
      heldBy: agentId,
      acquiredAt: new Date(now),
      expiresAt: new Date(now + ttlMs),
      ttlMs
    };

    this.locks.set(resource, token);
    return token;
  }

  /**
   * Releases a lock held by the specified agent.
   *
   * @param resource - Resource to unlock.
   * @param agentId - Agent releasing the lock.
   * @throws If no lock exists or it is held by a different agent.
   */
  releaseLock(resource: string, agentId: string): void {
    const lock = this.locks.get(resource);

    if (!lock) {
      throw new Error(`No lock found for resource "${resource}"`);
    }

    if (lock.heldBy !== agentId) {
      throw new Error(`Lock on resource "${resource}" is held by agent "${lock.heldBy}", not "${agentId}"`);
    }

    this.locks.delete(resource);
  }

  /**
   * Returns whether a resource is currently locked (and not expired).
   *
   * @param resource - Resource to check.
   * @returns `true` if the resource is locked and the lock has not expired.
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);
    if (!lock) {
      return false;
    }
    if (lock.expiresAt <= new Date()) {
      this.locks.delete(resource);
      return false;
    }
    return true;
  }

  /**
   * Removes all expired frames and expired locks.
   * Call periodically or after long-running tasks to prevent memory leaks.
   */
  cleanup(): void {
    const now = new Date();

    for (const [frameId, frame] of this.frames) {
      if (frame.expiry <= now) {
        this.frames.delete(frameId);
      }
    }

    for (const [resource, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(resource);
      }
    }
  }

  /** Returns the number of tracked context frames. */
  getFrameCount(): number {
    return this.frames.size;
  }

  /** Returns the number of tracked resource locks. */
  getLockCount(): number {
    return this.locks.size;
  }

  /**
   * Validates that the push-context input contains all required fields.
   *
   * @param frame - Frame data to validate.
   */
  private validatePushContext(frame: Omit<ContextFrame, 'frameId' | 'expiry'>): void {
    if (!frame.sessionId) {
      throw new Error('sessionId is required');
    }
    if (!frame.agentId) {
      throw new TypeError('agentId is required');
    }
    if (!Array.isArray(frame.visibleFields)) {
      throw new TypeError('visibleFields must be an array');
    }
    if (!Array.isArray(frame.lockedResources)) {
      throw new TypeError('lockedResources must be an array');
    }
    if (!frame.metadata || typeof frame.metadata !== 'object') {
      throw new Error('metadata must be a non-null object');
    }
  }
}
