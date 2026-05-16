import type { AgentFsEntry, AgentFsManager } from "./manager.js";

export interface Snapshot {
  readonly id: string;
  readonly label?: string;
  readonly timestamp: number;
  readonly entries: readonly AgentFsEntry[];
}

export interface SnapshotStore {
  capture(manager: AgentFsManager, label?: string): Snapshot;
  restore(snapshotId: string, manager: AgentFsManager): boolean;
  list(): Snapshot[];
  get(snapshotId: string): Snapshot | undefined;
  delete(snapshotId: string): boolean;
}

let snapCounter = 0;

function generateSnapshotId(): string {
  return `snap-${Date.now().toString(36)}-${(++snapCounter).toString(36).padStart(4, "0")}`;
}

export function createSnapshotStore(): SnapshotStore {
  const snapshots = new Map<string, Snapshot>();

  return {
    capture(manager, label) {
      const snapshot: Snapshot = {
        id: generateSnapshotId(),
        ...(label === undefined ? {} : { label }),
        timestamp: Date.now(),
        entries: manager.list().map((e) => ({ ...e })),
      };
      snapshots.set(snapshot.id, snapshot);
      return snapshot;
    },

    delete(snapshotId) {
      return snapshots.delete(snapshotId);
    },

    get(snapshotId) {
      return snapshots.get(snapshotId);
    },

    list() {
      return [...snapshots.values()].toSorted(
        (a, b) => b.timestamp - a.timestamp
      );
    },

    restore(snapshotId, manager) {
      const snapshot = snapshots.get(snapshotId);
      if (snapshot === undefined) {
        return false;
      }
      manager.clear();

      // Use manager.import() if available to preserve full entry metadata (timestamps)
      if (typeof manager.import === "function") {
        manager.import(snapshot.entries.map((e) => ({ ...e })));
      } else {
        // Fallback for simple manager implementations
        for (const entry of snapshot.entries) {
          manager.write(entry.path, entry.content);
        }
      }
      return true;
    },
  };
}
