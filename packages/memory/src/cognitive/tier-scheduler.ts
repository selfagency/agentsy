import type { PubSubManager } from '../coordination/pub-sub-manager.js';
import type { Scheduler } from '../coordination/scheduler.js';
import { applyDecay, type DecayConfig, DEFAULT_DECAY_CONFIG } from './decay.js';
import type { MemoryTierLike } from './memory-tier.js';
import type { TierName } from './tier-types.js';

export interface TierScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  runDecayPass(): DecayPassResult;
}

export interface DecayPassResult {
  kept: number;
  promoted: number;
  demoted: number;
  discarded: number;
  durationMs: number;
}

export interface TierSchedulerOptions {
  intervalMs?: number;
  decayConfig?: DecayConfig;
  scheduler?: Scheduler;
  pubsub?: PubSubManager;
  now?: (() => number) | undefined;
}

const DEFAULT_INTERVAL_MS = 30_000;

const TIER_CHANNEL = 'agentsy:memory:tier-scheduler';

export function createTierScheduler(
  tiers: Partial<Record<TierName, MemoryTierLike>>,
  options: TierSchedulerOptions = {}
): TierScheduler {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const decayConfig = options.decayConfig ?? DEFAULT_DECAY_CONFIG;
  const scheduler = options.scheduler;
  const pubsub = options.pubsub;
  const now = options.now ?? (() => performance.now());

  let running = false;
  const JOB_ID = 'agentsy:memory:decay-pass';

  return {
    isRunning(): boolean {
      return running;
    },

    runDecayPass(): DecayPassResult {
      const start = now();
      let kept = 0;
      let promoted = 0;
      let demoted = 0;
      let discarded = 0;

      const currentNow = now();

      const tierEntries = Object.entries(tiers) as [string, MemoryTierLike | undefined][];
      for (const [tierName, tier] of tierEntries) {
        if (!tier) continue;
        const items = tier.items();
        if (items.length === 0) continue;

        const decayed = applyDecay(items, tierName as TierName, currentNow, decayConfig);

        for (const result of decayed) {
          if (result.action === 'discard') {
            discarded++;
          } else if (result.action === 'promote') {
            promoted++;
          } else if (result.action === 'demote') {
            demoted++;
          } else {
            kept++;
          }
        }
      }

      const durationMs = now() - start;

      if (pubsub) {
        pubsub
          .publish(TIER_CHANNEL, {
            discarded,
            demoted,
            durationMs,
            kept,
            promoted,
            timestamp: currentNow
          })
          .catch(() => {
            // PubSub failures should not crash the scheduler
          });
      }

      return { kept, promoted, demoted, discarded, durationMs };
    },

    start(): void {
      if (running) return;
      running = true;

      if (scheduler) {
        const scheduleNext = () => {
          scheduler.schedule(JOB_ID, intervalMs, () => {
            this.runDecayPass();
            if (running) scheduleNext();
          });
        };
        scheduleNext();
      }
    },

    stop(): void {
      running = false;
      if (scheduler) {
        scheduler.cancel(JOB_ID);
      }
    }
  };
}
