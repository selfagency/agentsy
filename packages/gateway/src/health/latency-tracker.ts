export class LatencyTracker {
  readonly #values: number[] = [];
  readonly #windowSize: number;

  constructor(windowSize = 50) {
    this.#windowSize = windowSize;
  }

  record(latencyMs: number): void {
    this.#values.push(latencyMs);
    if (this.#values.length > this.#windowSize) {
      this.#values.shift();
    }
  }

  average(): number | undefined {
    if (this.#values.length === 0) {
      return;
    }

    const total = this.#values.reduce((sum, value) => sum + value, 0);
    return total / this.#values.length;
  }

  percentile(percentile: number): number | undefined {
    if (this.#values.length === 0) {
      return;
    }

    const sorted = [...this.#values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
    return sorted[index];
  }
}
