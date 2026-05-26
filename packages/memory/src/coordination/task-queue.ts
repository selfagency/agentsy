export interface CoordinationTask {
  id: string;
  payload?: Record<string, unknown>;
  type: string;
}

export interface TaskQueue {
  dequeue(): Promise<CoordinationTask | null>;
  enqueue(task: CoordinationTask): Promise<void>;
  size(): number;
}

export function createInMemoryTaskQueue(): TaskQueue {
  const queue: CoordinationTask[] = [];

  return {
    dequeue() {
      const task = queue.shift();
      return Promise.resolve(task ?? null);
    },

    enqueue(task: CoordinationTask) {
      queue.push(task);
      return Promise.resolve();
    },

    size() {
      return queue.length;
    }
  };
}
