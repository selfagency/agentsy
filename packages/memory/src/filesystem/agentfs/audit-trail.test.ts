import { describe, expect, it } from 'vitest';

import { createAuditTrail } from './audit-trail.js';

describe('createAuditTrail', () => {
  it('records a write event', () => {
    const trail = createAuditTrail();
    trail.record('write', '/a.txt', { contentHash: 'sha256:abc' });
    const events = trail.query();
    expect(events).toHaveLength(1);
    expect(events[0]?.operation).toBe('write');
    expect(events[0]?.path).toBe('/a.txt');
    expect(events[0]?.contentHash).toBe('sha256:abc');
  });

  it('assigns unique ids to events', () => {
    const trail = createAuditTrail();
    trail.record('read', '/x');
    trail.record('read', '/y');
    const events = trail.query();
    expect(events[0]?.id).toBeTruthy();
    expect(events[1]?.id).toBeTruthy();
    expect(events[0]?.id).not.toBe(events[1]?.id);
  });

  it('query() with no args returns all events', () => {
    const trail = createAuditTrail();
    trail.record('write', '/a');
    trail.record('delete', '/b');
    trail.record('read', '/c');
    const all = trail.query();
    expect(all).toHaveLength(3);
  });

  it('query(path) filters by path', () => {
    const trail = createAuditTrail();
    trail.record('write', '/a');
    trail.record('delete', '/b');
    trail.record('read', '/a');
    const result = trail.query('/a');
    expect(result).toHaveLength(2);
    for (const e of result) {
      expect(e.path).toBe('/a');
    }
  });

  it('byCorrelation() returns events for a correlation id', () => {
    const trail = createAuditTrail();
    trail.record('read', '/x', { correlationId: 'req-1' });
    trail.record('write', '/y', { correlationId: 'req-2' });
    const result = trail.byCorrelation('req-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('/x');
  });

  it('redacts secrets in path', () => {
    const trail = createAuditTrail();
    trail.record('write', '/files/key=sk-supersecretapikey12345678901234');
    const events = trail.query();
    expect(events[0]?.path).toContain('[REDACTED]');
    expect(events[0]?.path).not.toContain('sk-');
  });

  it('records actor when provided', () => {
    const trail = createAuditTrail();
    trail.record('read', '/doc.txt', { actor: 'agent-1' });
    const events = trail.query();
    expect(events[0]?.actor).toBe('agent-1');
  });

  it('clear() removes all events', () => {
    const trail = createAuditTrail();
    trail.record('read', '/a');
    trail.clear();
    expect(trail.query()).toHaveLength(0);
  });
});
