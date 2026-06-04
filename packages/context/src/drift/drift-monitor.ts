export interface CompressionCycleRecord {
  coherence: number;
  cycle: number;
  droppedMessages: number;
  timestamp?: Date;
}

export interface DriftMonitorStats {
  avgCoherence: number;
  cycles: number;
  isDrifting: boolean;
  maxCoherence: number;
  minCoherence: number;
  totalDropped: number;
}

export interface DriftMonitorOptions {
  driftThreshold?: number;
  maxCycles?: number;
}

export interface DriftMonitor {
  getStats(): DriftMonitorStats;
  isDrifting(): boolean;
  recordCompression(record: CompressionCycleRecord): void;
  reset(): void;
}

export function createDriftMonitor(options: DriftMonitorOptions = {}): DriftMonitor {
  const driftThreshold = options.driftThreshold ?? 0.65;
  const maxCycles = options.maxCycles ?? 50;
  const records: CompressionCycleRecord[] = [];

  function getStats(): DriftMonitorStats {
    if (records.length === 0) {
      return {
        avgCoherence: 1,
        cycles: 0,
        isDrifting: false,
        maxCoherence: 1,
        minCoherence: 1,
        totalDropped: 0
      };
    }

    const coherences = records.map(record => record.coherence);
    const totalDropped = records.reduce((total, record) => total + record.droppedMessages, 0);
    const avgCoherence = coherences.reduce((total, value) => total + value, 0) / coherences.length;

    return {
      avgCoherence,
      cycles: records.length,
      isDrifting: avgCoherence < driftThreshold || Math.min(...coherences) < driftThreshold,
      maxCoherence: Math.max(...coherences),
      minCoherence: Math.min(...coherences),
      totalDropped
    };
  }

  return {
    getStats,
    isDrifting: () => getStats().isDrifting,
    recordCompression(record) {
      records.push({
        ...record,
        timestamp: record.timestamp ?? new Date()
      });

      if (records.length > maxCycles) {
        records.shift();
      }
    },
    reset() {
      records.length = 0;
    }
  };
}
