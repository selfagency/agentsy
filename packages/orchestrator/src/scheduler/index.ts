export type SchedulerTaskStatus = 'pending' | 'scheduled' | 'cancelled';

export type SchedulerExecutionInput<T> = (() => Promise<T>) | { taskInfo: unknown; agents: unknown[] };

export interface TaskScheduler {
  schedule<T>(task: SchedulerExecutionInput<T>): Promise<T>;
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

export interface SchedulerRegistry {
  register(task: SchedulerTaskDefinition): SchedulerTaskRecord;
  cancel(taskId: string): SchedulerTaskRecord | null;
  get(taskId: string): SchedulerTaskRecord | null;
  list(options?: { lane?: string; status?: SchedulerTaskStatus }): SchedulerTaskRecord[];
}

export function createSchedulerRegistry(initialTasks: SchedulerTaskDefinition[] = []): SchedulerRegistry {
  const tasks = new Map<string, SchedulerTaskRecord>();

  const register = (task: SchedulerTaskDefinition): SchedulerTaskRecord => {
    const record: SchedulerTaskRecord = {
      ...task,
      createdAt: Date.now(),
      status: task.runAt !== undefined ? 'scheduled' : 'pending',
    };
    tasks.set(task.id, record);
    return { ...record };
  };

  for (const task of initialTasks) {
    register(task);
  }

  return {
    register,

    cancel(taskId) {
      const record = tasks.get(taskId);
      if (!record) {
        return null;
      }

      const cancelled: SchedulerTaskRecord = {
        ...record,
        status: 'cancelled',
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
        .sort((left, right) => left.createdAt - right.createdAt)
        .map(task => ({ ...task }));
    },
  };
}

export function createTaskScheduler(registry: SchedulerRegistry = createSchedulerRegistry()): TaskScheduler {
  return {
    async schedule<T>(task: SchedulerExecutionInput<T>): Promise<T> {
      if (typeof task === 'function') {
        return task();
      }

      const schedulerTask = task.taskInfo as {
        id?: string;
        name?: string;
        input?: unknown;
        runAt?: number;
      };
      const availableAgents = task.agents.filter(agent => {
        return typeof agent === 'object' && agent !== null && 'id' in agent;
      }) as Array<{ id: string; available?: boolean }>;
      const selectedAgent = availableAgents.find(agent => agent.available !== false) ?? availableAgents[0];

      if (!selectedAgent) {
        return null as T;
      }

      registry.register({
        id: schedulerTask.id ?? `scheduled-${Math.random().toString(36).slice(2, 10)}`,
        prompt: schedulerTask.name ?? schedulerTask.id ?? 'scheduled task',
        ...(typeof schedulerTask.runAt === 'number' ? { runAt: schedulerTask.runAt } : {}),
        metadata: {
          input: schedulerTask.input,
          assignedAgentId: selectedAgent.id,
        },
      });

      return {
        agentId: selectedAgent.id,
        assigned: true,
        status: 'scheduled',
      } as T;
    },
  };
}
