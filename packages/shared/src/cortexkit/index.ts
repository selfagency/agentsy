export {
  type AftBridgeOptions,
  getAftBridge,
  getAftSessionBridge,
  isAftAvailable,
  shutdownAftBridge
} from './aft-manager.js';
export type { CortexKitDb } from './db.js';
export { openCortexKitDb, openCortexKitDbReadOnly, withRetry } from './db.js';
export {
  ensureCortexKitDbDir,
  isCortexKitDbPresent,
  resolveCortexKitDbDir,
  resolveCortexKitDbPath
} from './db-path.js';
export {
  COMPARTMENTS_COLUMNS,
  COMPARTMENTS_TABLE,
  PROJECT_MEMORIES_COLUMNS,
  PROJECT_MEMORIES_TABLE,
  PROJECT_STATE_COLUMNS,
  PROJECT_STATE_TABLE,
  SESSION_META_COLUMNS,
  SESSION_META_TABLE
} from './schema.js';
