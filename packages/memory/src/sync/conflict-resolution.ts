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
  metadata: 'local',
  content: 'remote',
  relationships: 'local',
  vectorFingerprint: 'remote'
} as const;

function createRecordKey(record: Pick<SyncRecord, 'id' | 'tier'>): string {
  return `${record.tier}:${record.id}`;
}

function createConflictId(local: SyncRecord, remote: SyncRecord): string {
  const source = JSON.stringify({
    id: local.id,
    tier: local.tier,
    localUpdatedAt: local.updatedAt,
    remoteUpdatedAt: remote.updatedAt,
    localContent: local.content,
    remoteContent: remote.content
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
    precedence.relationships === 'local' ? (local.relationships ?? []).slice() : (remote.relationships ?? []).slice();
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
      id: createConflictId(local, remote),
      recordId: local.id,
      tier: local.tier,
      local,
      remote,
      detectedAt,
      policy
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
      status: 'manual',
      policy,
      record: null
    };
  }

  if (policy === 'localWins') {
    return { status: 'resolved', policy, record: chooseRecord('local', conflict.local, conflict.remote) };
  }

  if (policy === 'remoteWins') {
    return { status: 'resolved', policy, record: chooseRecord('remote', conflict.local, conflict.remote) };
  }

  if (policy === 'fieldMerge' && conflict.tier === 'wiki') {
    return { status: 'resolved', policy, record: mergeWikiConflict(conflict, options) };
  }

  const localTime = Date.parse(conflict.local.updatedAt);
  const remoteTime = Date.parse(conflict.remote.updatedAt);

  return {
    status: 'resolved',
    policy,
    record:
      localTime > remoteTime
        ? chooseRecord('local', conflict.local, conflict.remote)
        : chooseRecord('remote', conflict.local, conflict.remote)
  };
}
