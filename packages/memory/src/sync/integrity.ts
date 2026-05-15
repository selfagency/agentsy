import { createHash } from 'node:crypto';

import type { RemoteValidationResult, SyncRecord, SyncSnapshot } from './types.js';

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidTier(tier: unknown): boolean {
  return tier === 'raw' || tier === 'wiki' || tier === 'vector';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function computeSyncChecksum(payload: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

export function verifySyncChecksum(payload: unknown, checksum: string): boolean {
  return computeSyncChecksum(payload) === checksum;
}

export function validateRemoteSnapshot(payload: unknown): RemoteValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(payload)) {
    return {
      valid: false,
      errors: ['payload must be an object']
    };
  }

  if (typeof payload.cursor !== 'string') {
    errors.push('cursor must be a string');
  }

  const records = payload.records;

  if (!Array.isArray(records)) {
    errors.push('records must be an array');
  } else {
    records.forEach((record, index) => {
      if (!isPlainObject(record)) {
        errors.push(`records[${index}] must be an object`);
        return;
      }

      if (typeof record.id !== 'string' || record.id.length === 0) {
        errors.push(`records[${index}].id must be a non-empty string`);
      }

      if (!isValidTier(record.tier)) {
        errors.push(`records[${index}].tier must be one of raw|wiki|vector`);
      }

      if (!isIsoDate(record.updatedAt)) {
        errors.push(`records[${index}].updatedAt must be a valid ISO date string`);
      }

      if (typeof record.content !== 'string') {
        errors.push(`records[${index}].content must be a string`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function cloneSyncSnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  return {
    cursor: snapshot.cursor,
    records: snapshot.records.map((record: SyncRecord) => ({
      ...record,
      ...(record.metadata === undefined ? {} : { metadata: record.metadata }),
      ...(record.metadata === undefined ? {} : { metadata: cloneJsonValue(record.metadata) }),
      ...(record.relationships === undefined ? {} : { relationships: [...record.relationships] })
    }))
  };
}
