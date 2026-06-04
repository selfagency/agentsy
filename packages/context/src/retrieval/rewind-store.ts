export interface RewindMarker {
  id: string;
  kind: 'code' | 'inline-code' | 'url' | 'text';
  source: string;
}

export interface RewindRecord {
  markers: RewindMarker[];
  original: string;
}

export interface RewindStore {
  get(id: string): RewindRecord | null;
  put(record: RewindRecord): void;
  resolve(id: string): string | null;
}

export function createRewindStore(): RewindStore {
  const records = new Map<string, RewindRecord>();

  return {
    get(id) {
      return records.get(id) ?? null;
    },

    put(record) {
      for (const marker of record.markers) {
        records.set(marker.id, record);
      }
    },

    resolve(id) {
      return records.get(id)?.original ?? null;
    }
  };
}
