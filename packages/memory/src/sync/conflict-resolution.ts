import { createHash } from 'node:crypto';

import type { ConflictRecord, ConflictResolutionResult, MergePolicy, SyncRecord } from './types.js';

interface CollectConflictsOptions {
  detectedAt?: string;
  policy?: MergePolicy;
}

interface ResolveConflictOptions {
  wikiFieldPrecedence?: {
    metadata?: 'local' | 'remote';
    content?: 'local' | 'remote';
    relationships?: 'local' | 'remote';
    vectorFingerprint?: 'local' | 'remote';
  };
}

const DEFAULT_WIKI_FIELD_PRECEDENCE = {
  content: 'remote',
  metadata: 'local',
  relationships: 'local',
  vectorFingerprint: 'remote'
} as const;

function createRecordKey(record: Pick<SyncRecord, 'id' | 'tier'>): string {
  return `${record.tier}:${record.id}`;
}

function createConflictId(local: SyncRecord, remote: SyncRecord): string {
  const source = JSON.stringify({
    id: local.id,
    localContent: local.content,
    localUpdatedAt: local.updatedAt,
    remoteContent: remote.content,
    remoteUpdatedAt: remote.updatedAt,
    tier: local.tier
  });

  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

function isRecordEqual(left: SyncRecord, right: SyncRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function chooseRecord(preference: 'local' | 'remote', local: SyncRecord, remote: SyncRecord): SyncRecord {
  const preferred = preference === 'local' ? local : remote;

  return {
    ...preferred,
    ...(preferred.metadata === undefined ? {} : { metadata: preferred.metadata }),
    ...(preferred.relationships === undefined ? {} : { relationships: [...preferred.relationships] })
  };
}

function mergeWikiConflict(conflict: ConflictRecord, options: ResolveConflictOptions = {}): SyncRecord {
  const precedence = {
    ...DEFAULT_WIKI_FIELD_PRECEDENCE,
    ...options.wikiFieldPrecedence
  };

  const { local, remote } = conflict;
  const metadata = precedence.metadata === 'local' ? local.metadata : remote.metadata;
  const relationships =
    precedence.relationships === 'local' ? [...(local.relationships ?? [])] : [...(remote.relationships ?? [])];
  const vectorFingerprint =
    precedence.vectorFingerprint === 'local' ? local.vectorFingerprint : remote.vectorFingerprint;

  return {
    ...chooseRecord('local', local, remote),
    ...(metadata === undefined ? {} : { metadata }),
    content: precedence.content === 'local' ? local.content : remote.content,
    ...(relationships.length === 0 ? {} : { relationships }),
    ...(vectorFingerprint === undefined ? {} : { vectorFingerprint }),
    updatedAt: new Date(Math.max(Date.parse(local.updatedAt), Date.parse(remote.updatedAt))).toISOString()
  };
}

export function collectConflicts(
  localBatch: SyncRecord[],
  remoteBatch: SyncRecord[],
  options: CollectConflictsOptions = {}
): ConflictRecord[] {
  const remoteById = new Map(remoteBatch.map(record => [createRecordKey(record), record]));
  const detectedAt = options.detectedAt ?? new Date().toISOString();
  const policy = options.policy ?? 'lastWriteWins';
  const conflicts: ConflictRecord[] = [];

  for (const local of localBatch) {
    const remote = remoteById.get(createRecordKey(local));
    if (!remote || isRecordEqual(local, remote)) {
      continue;
    }

    conflicts.push({
      detectedAt,
      id: createConflictId(local, remote),
      local,
      policy,
      recordId: local.id,
      remote,
      tier: local.tier
    });
  }

  return conflicts;
}

export function resolveConflict(
  conflict: ConflictRecord,
  policy: MergePolicy,
  options: ResolveConflictOptions = {}
): ConflictResolutionResult {
  if (policy === 'manualRequired') {
    return {
      policy,
      record: null,
      status: 'manual'
    };
  }

  if (policy === 'localWins') {
    return {
      policy,
      record: chooseRecord('local', conflict.local, conflict.remote),
      status: 'resolved'
    };
  }

  if (policy === 'remoteWins') {
    return {
      policy,
      record: chooseRecord('remote', conflict.local, conflict.remote),
      status: 'resolved'
    };
  }

  if (policy === 'fieldMerge' && conflict.tier === 'wiki') {
    return {
      policy,
      record: mergeWikiConflict(conflict, options),
      status: 'resolved'
    };
  }

  const localTime = Date.parse(conflict.local.updatedAt);
  const remoteTime = Date.parse(conflict.remote.updatedAt);

  return {
    policy,
    record:
      localTime > remoteTime
        ? chooseRecord('local', conflict.local, conflict.remote)
        : chooseRecord('remote', conflict.local, conflict.remote),
    status: 'resolved'
  };
}
