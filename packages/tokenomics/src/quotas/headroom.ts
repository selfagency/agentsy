/**
 * Replica-level budget and headroom types for quota-aware routing.
 *
 * These types extend the existing `TokenBudget`/`TokenUsage` system
 * with replica and account identity, enabling gateway to make
 * per-replica routing decisions based on remaining quota.
 */

import type { TokenUsage } from '../token-manager.js';

// =============================================================================
// Extended usage identity — optional fields on existing TokenUsage
// =============================================================================

/**
 * Extends the base `TokenUsage` with replica-level routing context.
 * These fields are optional — existing call sites that don't use
 * replica routing are unaffected.
 */
export interface ReplicaUsageFields {
  accountId?: string;
  logicalModelId?: string;
  replicaId?: string;
}

export type ReplicaAwareUsage = TokenUsage & ReplicaUsageFields;

// =============================================================================
// Replica budget
// =============================================================================

export interface ReplicaBudget {
  accountId?: string;
  logicalModelId: string;
  maxCostHour?: number;
  maxCostMonth?: number;
  maxCostWeek?: number;
  maxTokensHour?: number;
  maxTokensMonth?: number;
  maxTokensWeek?: number;
  providerId: string;
  replicaId: string;
}

// =============================================================================
// Headroom snapshot — what remains for routing decisions
// =============================================================================

export type HeadroomConfidence = 'header-derived' | 'tokenomics-derived' | 'estimated';

export interface ReplicaHeadroomSnapshot {
  confidence: HeadroomConfidence;
  lastUpdatedAt: string;
  logicalModelId: string;
  providerId: string;
  remainingCostHour?: number;
  remainingCostMonth?: number;
  remainingCostWeek?: number;
  remainingTokensHour?: number;
  remainingTokensMonth?: number;
  remainingTokensWeek?: number;
  replicaId: string;
}

// =============================================================================
// Window algebra
// =============================================================================

export function alignToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

export function alignToWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function alignToMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const HOUR_MS = 3_600_000;
export const WEEK_MS = 7 * 24 * HOUR_MS;
export const MONTH_MS = 30 * 24 * HOUR_MS;
