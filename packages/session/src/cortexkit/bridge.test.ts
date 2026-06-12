import { describe, expect, it } from 'vitest';
import { createCortexKitSessionStore } from './session-store.js';
import { createCortexKitSnapshotBridge } from './snapshot-bridge.js';

describe('CortexKit session store', () => {
  it('creates a store factory with correct interface', () => {
    // The factory requires a DB — verify the type contract
    const factory = createCortexKitSessionStore;
    expect(factory).toBeInstanceOf(Function);
    expect(factory.length).toBe(2); // sessionId, db
  });

  it('snapshot bridge factory has correct interface', () => {
    const factory = createCortexKitSnapshotBridge;
    expect(factory).toBeInstanceOf(Function);
    expect(factory.length).toBe(1); // db
  });
});
