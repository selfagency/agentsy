export type { DedupEntry, DedupStore } from './dedup-store.js';
export { createDedupStore } from './dedup-store.js';
export type { ContentFingerprint } from './fingerprint.js';
export { fingerprintContent, fingerprintsEqual } from './fingerprint.js';
export type { MigrateStats } from './migrate.js';
export { migrateContentToDedupStore } from './migrate.js';
export type { VerifyResult } from './verify.js';
export { assertContent, verifyContent } from './verify.js';
