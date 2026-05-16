import { createAgentLoop } from './agent/index.js';
import type { AgentLoopHandle, AgentLoopOptions } from './agent/index.js';
import { createSchedulerRegistry } from './scheduler/index.js';
import type {
  SchedulerRegistry,
  SchedulerTaskDefinition,
  SchedulerTaskRecord,
  SchedulerTaskStatus
} from './scheduler/index.js';

export interface OrchestratorConfig extends AgentLoopOptions {
  scheduler?: SchedulerRegistry;
  initialScheduledTasks?: SchedulerTaskDefinition[];
}

export interface OrchestratorLoop extends AgentLoopHandle {
  scheduleTask(task: SchedulerTaskDefinition): SchedulerTaskRecord;
  cancelScheduledTask(taskId: string): SchedulerTaskRecord | null;
  getScheduledTask(taskId: string): SchedulerTaskRecord | null;
  listScheduledTasks(options?: { lane?: string; status?: SchedulerTaskStatus }): SchedulerTaskRecord[];
}

export function createOrchestratorLoop(config: OrchestratorConfig): OrchestratorLoop {
  const scheduler = config.scheduler ?? createSchedulerRegistry(config.initialScheduledTasks ?? []);
  const handle = createAgentLoop(config);

  return {
    ...handle,
    cancelScheduledTask(taskId) {
      return scheduler.cancel(taskId);
    },
    getScheduledTask(taskId) {
      return scheduler.get(taskId);
    },
    listScheduledTasks(options) {
      return scheduler.list(options);
    },
    scheduleTask(task) {
      return scheduler.register(task);
    }
  };
}
