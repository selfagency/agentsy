import { describe, expect, it } from 'vitest';

import {
  alignToHour,
  alignToMonth,
  alignToWeek,
  computeHeadroomPercentage,
  HOUR_MS,
  MINUTE_MS,
  MONTH_MS,
  WEEK_MS
} from './headroom.js';

describe('alignToHour', () => {
  it('zeroes minutes, seconds, milliseconds', () => {
    const d = new Date('2026-06-06T14:35:22.123Z');
    const aligned = alignToHour(d);
    expect(aligned.getUTCMinutes()).toBe(0);
    expect(aligned.getUTCSeconds()).toBe(0);
    expect(aligned.getUTCMilliseconds()).toBe(0);
    expect(aligned.getUTCHours()).toBe(14);
  });
});

describe('alignToWeek', () => {
  it('moves to the start of the week (Sunday 00:00:00)', () => {
    const d = new Date('2026-06-06T14:35:22.123Z');
    const aligned = alignToWeek(d);
    expect(aligned.getMilliseconds()).toBe(0);
    expect(aligned.getSeconds()).toBe(0);
    expect(aligned.getMinutes()).toBe(0);
    expect(aligned.getHours()).toBe(0);
    // Sunday is getDay() === 0
    expect(aligned.getDay()).toBe(0);
    // Must be before or equal to the original date
    expect(aligned.getTime()).toBeLessThanOrEqual(d.getTime());
  });
});

describe('alignToMonth', () => {
  it('sets to 1st 00:00:00.000 of the same month', () => {
    const d = new Date('2026-06-06T14:35:22.123Z');
    const aligned = alignToMonth(d);
    expect(aligned.getMilliseconds()).toBe(0);
    expect(aligned.getSeconds()).toBe(0);
    expect(aligned.getMinutes()).toBe(0);
    expect(aligned.getHours()).toBe(0);
    expect(aligned.getDate()).toBe(1);
    expect(aligned.getMonth()).toBe(d.getMonth());
    expect(aligned.getFullYear()).toBe(d.getFullYear());
  });
});

describe('time constants', () => {
  it('MINUTE_MS is correct', () => {
    expect(MINUTE_MS).toBe(60_000);
  });
  it('HOUR_MS is correct', () => {
    expect(HOUR_MS).toBe(3_600_000);
  });
  it('WEEK_MS is correct', () => {
    expect(WEEK_MS).toBe(7 * 24 * HOUR_MS);
  });
  it('MONTH_MS is correct', () => {
    expect(MONTH_MS).toBe(30 * 24 * HOUR_MS);
  });
});

describe('computeHeadroomPercentage', () => {
  it('returns 100 when fully remaining', () => {
    expect(computeHeadroomPercentage(100, 100)).toBe(100);
  });

  it('returns 50 at half', () => {
    expect(computeHeadroomPercentage(50, 100)).toBe(50);
  });

  it('returns 0 when max is zero', () => {
    expect(computeHeadroomPercentage(100, 0)).toBe(0);
  });

  it('returns 0 when max is negative', () => {
    expect(computeHeadroomPercentage(100, -1)).toBe(0);
  });

  it('clamps to 100 when remaining exceeds max', () => {
    expect(computeHeadroomPercentage(150, 100)).toBe(100);
  });

  it('clamps to 0 when remaining is negative', () => {
    expect(computeHeadroomPercentage(-10, 100)).toBe(0);
  });

  it('rounds to integer', () => {
    const result = computeHeadroomPercentage(33, 100);
    expect(result).toBe(33);
  });
});
