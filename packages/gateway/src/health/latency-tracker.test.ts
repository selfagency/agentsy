import { describe, expect, it } from 'vitest';
import { LatencyTracker } from './latency-tracker.js';

describe('LatencyTracker', () => {
  describe('constructor', () => {
    it('should use default window size of 50', () => {
      const tracker = new LatencyTracker();
      expect(tracker.average()).toBeUndefined();
    });

    it('should use custom window size', () => {
      const tracker = new LatencyTracker(10);
      expect(tracker.average()).toBeUndefined();
    });
  });

  describe('record', () => {
    it('should add latency values', () => {
      const tracker = new LatencyTracker(3);
      tracker.record(100);
      tracker.record(200);
      tracker.record(300);

      expect(tracker.average()).toBe(200);
    });

    it('should maintain window size', () => {
      const tracker = new LatencyTracker(2);
      tracker.record(100);
      tracker.record(200);
      tracker.record(300);
      tracker.record(400);

      expect(tracker.average()).toBe(350);
    });

    it('should handle single value window', () => {
      const tracker = new LatencyTracker(1);
      tracker.record(100);
      tracker.record(200);
      tracker.record(300);

      expect(tracker.average()).toBe(300);
    });

    it('should handle zero latency', () => {
      const tracker = new LatencyTracker(3);
      tracker.record(0);
      tracker.record(100);
      tracker.record(200);

      expect(tracker.average()).toBe(100);
    });

    it('should handle large latency values', () => {
      const tracker = new LatencyTracker(3);
      tracker.record(10_000);
      tracker.record(20_000);
      tracker.record(30_000);

      expect(tracker.average()).toBe(20_000);
    });

    it('should handle fractional latency values', () => {
      const tracker = new LatencyTracker(3);
      tracker.record(100.5);
      tracker.record(200.5);
      tracker.record(300.5);

      expect(tracker.average()).toBe(200.5);
    });
  });

  describe('average', () => {
    it('should return undefined when no values', () => {
      const tracker = new LatencyTracker();
      expect(tracker.average()).toBeUndefined();
    });

    it('should return average of all values', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);

      expect(tracker.average()).toBe(20);
    });

    it('should return average of values in window', () => {
      const tracker = new LatencyTracker(3);
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);
      tracker.record(40);
      tracker.record(50);

      expect(tracker.average()).toBe(40);
    });

    it('should handle single value', () => {
      const tracker = new LatencyTracker();
      tracker.record(100);

      expect(tracker.average()).toBe(100);
    });

    it('should update as values are added', () => {
      const tracker = new LatencyTracker();
      tracker.record(100);
      expect(tracker.average()).toBe(100);

      tracker.record(200);
      expect(tracker.average()).toBe(150);

      tracker.record(300);
      expect(tracker.average()).toBe(200);
    });
  });

  describe('percentile', () => {
    it('should return undefined when no values', () => {
      const tracker = new LatencyTracker();
      expect(tracker.percentile(50)).toBeUndefined();
    });

    it('should return 50th percentile', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);
      tracker.record(40);
      tracker.record(50);

      expect(tracker.percentile(50)).toBe(30);
    });

    it('should return 90th percentile', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);
      tracker.record(40);
      tracker.record(50);
      tracker.record(60);
      tracker.record(70);
      tracker.record(80);
      tracker.record(90);
      tracker.record(100);

      expect(tracker.percentile(90)).toBe(90);
    });

    it('should return 95th percentile', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);
      tracker.record(40);
      tracker.record(50);
      tracker.record(60);
      tracker.record(70);
      tracker.record(80);
      tracker.record(90);
      tracker.record(100);

      expect(tracker.percentile(95)).toBe(100);
    });

    it('should return 99th percentile', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);
      tracker.record(40);
      tracker.record(50);
      tracker.record(60);
      tracker.record(70);
      tracker.record(80);
      tracker.record(90);
      tracker.record(100);

      expect(tracker.percentile(99)).toBe(100);
    });

    it('should return 0th percentile (minimum)', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);

      expect(tracker.percentile(0)).toBe(10);
    });

    it('should return 100th percentile (maximum)', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);

      expect(tracker.percentile(100)).toBe(30);
    });

    it('should handle unsorted values', () => {
      const tracker = new LatencyTracker();
      tracker.record(50);
      tracker.record(10);
      tracker.record(30);
      tracker.record(20);
      tracker.record(40);

      expect(tracker.percentile(50)).toBe(30);
    });

    it('should handle duplicate values', () => {
      const tracker = new LatencyTracker();
      tracker.record(20);
      tracker.record(20);
      tracker.record(20);

      expect(tracker.percentile(50)).toBe(20);
    });

    it('should respect window size', () => {
      const tracker = new LatencyTracker(3);
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);
      tracker.record(40);
      tracker.record(50);

      expect(tracker.percentile(50)).toBe(40);
    });

    it('should handle single value', () => {
      const tracker = new LatencyTracker();
      tracker.record(100);

      expect(tracker.percentile(50)).toBe(100);
    });

    it('should handle edge case percentiles', () => {
      const tracker = new LatencyTracker();
      tracker.record(10);
      tracker.record(20);
      tracker.record(30);

      expect(tracker.percentile(1)).toBe(10);
      expect(tracker.percentile(99)).toBe(30);
    });
  });

  describe('integration scenarios', () => {
    it('should track latency over time', () => {
      const tracker = new LatencyTracker(5);

      tracker.record(100);
      expect(tracker.average()).toBe(100);

      tracker.record(150);
      expect(tracker.average()).toBe(125);

      tracker.record(200);
      expect(tracker.average()).toBe(150);

      tracker.record(250);
      expect(tracker.average()).toBe(175);

      tracker.record(300);
      expect(tracker.average()).toBe(200);
    });

    it('should handle latency spikes', () => {
      const tracker = new LatencyTracker(10);

      for (let i = 0; i < 9; i++) {
        tracker.record(100);
      }

      tracker.record(1000);

      expect(tracker.average()).toBe(190);
      expect(tracker.percentile(90)).toBe(100);
      expect(tracker.percentile(50)).toBe(100);
    });

    it('should maintain accurate statistics with window rotation', () => {
      const tracker = new LatencyTracker(3);

      tracker.record(100);
      tracker.record(200);
      tracker.record(300);
      expect(tracker.average()).toBe(200);

      tracker.record(400);
      tracker.record(500);
      tracker.record(600);
      expect(tracker.average()).toBe(500);

      tracker.record(700);
      tracker.record(800);
      tracker.record(900);
      expect(tracker.average()).toBe(800);
    });
  });
});
