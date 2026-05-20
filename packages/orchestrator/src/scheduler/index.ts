import { randomUUID } from 'node:crypto';

export type SchedulerTaskStatus = 'pending' | 'scheduled' | 'cancelled';

export interface SchedulerTaskRequest {
  taskInfo: unknown;
  agents: unknown[];
}

export type SchedulerExecutionInput<T> = (() => Promise<T>) | SchedulerTaskRequest;

export interface TaskScheduler {
  schedule<T>(task: () => Promise<T>): Promise<T>;
  schedule(task: SchedulerTaskRequest): Promise<SchedulerAssignment | null>;
}

export interface SchedulerAssignment {
  agentId: string;
  assigned: true;
  status: 'scheduled';
}

export interface SchedulerTaskDefinition {
  id: string;
  prompt: string;
  runAt?: number;
  lane?: string;
  metadata?: Record<string, unknown>;
}

export interface SchedulerTaskRecord extends SchedulerTaskDefinition {
  createdAt: number;
  status: SchedulerTaskStatus;
}

interface SchedulerTaskInfo {
  id?: string;
  name?: string;
  input?: unknown;
  runAt?: number;
}

interface SchedulableAgent {
  id: string;
  available?: boolean;
}

export interface SchedulerRegistry {
  register(task: SchedulerTaskDefinition): SchedulerTaskRecord;
  cancel(taskId: string): SchedulerTaskRecord | null;
  get(taskId: string): SchedulerTaskRecord | null;
  list(options?: { lane?: string; status?: SchedulerTaskStatus }): SchedulerTaskRecord[];
}

function createScheduledTaskId(): string {
  return `scheduled-${randomUUID()}`;
}

export function createSchedulerRegistry(initialTasks: SchedulerTaskDefinition[] = []): SchedulerRegistry {
  const tasks = new Map<string, SchedulerTaskRecord>();

  const register = (task: SchedulerTaskDefinition): SchedulerTaskRecord => {
    const record: SchedulerTaskRecord = {
      ...task,
      createdAt: Date.now(),
      status: task.runAt === undefined ? 'pending' : 'scheduled'
    };
    tasks.set(task.id, record);
    return { ...record };
  };

  for (const task of initialTasks) {
    register(task);
  }

  return {
    cancel(taskId) {
      const record = tasks.get(taskId);
      if (!record) {
        return null;
      }

      const cancelled: SchedulerTaskRecord = {
        ...record,
        status: 'cancelled'
      };
      tasks.set(taskId, cancelled);
      return { ...cancelled };
    },

    get(taskId) {
      const record = tasks.get(taskId);
      return record ? { ...record } : null;
    },

    list(options = {}) {
      return [...tasks.values()]
        .filter(task => (options.lane ? task.lane === options.lane : true))
        .filter(task => (options.status ? task.status === options.status : true))
        .toSorted((left, right) => left.createdAt - right.createdAt)
        .map(task => ({ ...task }));
    },

    register
  };
}

export function createTaskScheduler(registry: SchedulerRegistry = createSchedulerRegistry()): TaskScheduler {
  const isSchedulableAgent = (agent: unknown): agent is SchedulableAgent =>
    typeof agent === 'object' && agent !== null && 'id' in agent && typeof agent.id === 'string';

  const toSchedulerTaskInfo = (taskInfo: unknown): SchedulerTaskInfo => {
    if (typeof taskInfo !== 'object' || taskInfo === null) {
      return {};
    }

    const candidate = taskInfo as Record<string, unknown>;
    return {
      ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}),
      ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}),
      ...(candidate.input === undefined ? {} : { input: candidate.input }),
      ...(typeof candidate.runAt === 'number' ? { runAt: candidate.runAt } : {})
    };
  };

  return {
    async schedule<T>(task: SchedulerExecutionInput<T>): Promise<SchedulerAssignment | T | null> {
      if (typeof task === 'function') {
        return await task();
      }

      const schedulerTask = toSchedulerTaskInfo(task.taskInfo);
      const availableAgents = task.agents.filter(isSchedulableAgent);
      const selectedAgent = availableAgents.find(agent => agent.available) ?? availableAgents[0];

      if (!selectedAgent) {
        return null;
      }

      registry.register({
        id: schedulerTask.id ?? createScheduledTaskId(),
        prompt: schedulerTask.name ?? schedulerTask.id ?? 'scheduled task',
        ...(typeof schedulerTask.runAt === 'number' ? { runAt: schedulerTask.runAt } : {}),
        metadata: {
          assignedAgentId: selectedAgent.id,
          input: schedulerTask.input
        }
      });

      return {
        agentId: selectedAgent.id,
        assigned: true,
        status: 'scheduled'
      };
    }
  };
}
