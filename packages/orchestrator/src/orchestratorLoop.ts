import { createAgentLoop, type AgentLoopHandle, type AgentLoopOptions } from './agent/index.js';
import {
  createSchedulerRegistry,
  type SchedulerRegistry,
  type SchedulerTaskDefinition,
  type SchedulerTaskRecord,
  type SchedulerTaskStatus
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
    scheduleTask(task) {
      return scheduler.register(task);
    },
    cancelScheduledTask(taskId) {
      return scheduler.cancel(taskId);
    },
    getScheduledTask(taskId) {
      return scheduler.get(taskId);
    },
    listScheduledTasks(options) {
      return scheduler.list(options);
    }
  };
}
