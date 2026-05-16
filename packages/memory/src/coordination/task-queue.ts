export interface CoordinationTask {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface TaskQueue {
  enqueue(task: CoordinationTask): Promise<void>;
  dequeue(): Promise<CoordinationTask | null>;
  size(): number;
}

export function createInMemoryTaskQueue(): TaskQueue {
  const queue: CoordinationTask[] = [];

  return {
    async dequeue() {
      const task = queue.shift();
      return task ?? null;
    },

    async enqueue(task: CoordinationTask) {
      queue.push(task);
    },

    size() {
      return queue.length;
    }
  };
}
