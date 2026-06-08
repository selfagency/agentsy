import type { AgentLoopHandle, AgentLoopOptions } from './agent/index.js';
import { createAgentLoop } from './agent/index.js';
import { BUILTIN_HELPER_ROLES } from './helpers/builtins.js';
import { createHelperRoleRegistry } from './helpers/registry.js';
import type { HelperRoleDefinition } from './helpers/types.js';
import type {
  SchedulerRegistry,
  SchedulerTaskDefinition,
  SchedulerTaskRecord,
  SchedulerTaskStatus
} from './scheduler/index.js';
import { createSchedulerRegistry } from './scheduler/index.js';

export interface OrchestratorConfig extends AgentLoopOptions {
  helperRoles?: HelperRoleDefinition[];
  initialScheduledTasks?: SchedulerTaskDefinition[];
  scheduler?: SchedulerRegistry;
}

export interface OrchestratorLoop extends AgentLoopHandle {
  cancelScheduledTask(taskId: string): SchedulerTaskRecord | null;
  getHelperRole(id: string): HelperRoleDefinition | undefined;
  getScheduledTask(taskId: string): SchedulerTaskRecord | null;
  listHelperRoles(): HelperRoleDefinition[];
  listScheduledTasks(options?: { lane?: string; status?: SchedulerTaskStatus }): SchedulerTaskRecord[];
  scheduleTask(task: SchedulerTaskDefinition): SchedulerTaskRecord;
}

export function createOrchestratorLoop(config: OrchestratorConfig): OrchestratorLoop {
  const scheduler = config.scheduler ?? createSchedulerRegistry(config.initialScheduledTasks ?? []);
  const helperRegistry = createHelperRoleRegistry([...(config.helperRoles ?? []), ...BUILTIN_HELPER_ROLES]);
  const handle = createAgentLoop(config);

  return {
    ...handle,
    cancelScheduledTask(taskId) {
      return scheduler.cancel(taskId);
    },
    getHelperRole(id) {
      return helperRegistry.get(id);
    },
    getScheduledTask(taskId) {
      return scheduler.get(taskId);
    },
    listHelperRoles() {
      return helperRegistry.list();
    },
    listScheduledTasks(options) {
      return scheduler.list(options);
    },
    scheduleTask(task) {
      return scheduler.register(task);
    }
  };
}
