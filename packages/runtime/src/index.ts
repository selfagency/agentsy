export interface RuntimeTask {
  id: string;
  run(signal: AbortSignal): Promise<void>;
}

export interface RuntimeOptions {
  onError?: (error: Error, task: RuntimeTask) => void;
}

export interface RuntimeExecutor {
  execute(tasks: RuntimeTask[], signal?: AbortSignal): Promise<void>;
}

export const createRuntimeExecutor = (options: RuntimeOptions = {}): RuntimeExecutor => ({
  async execute(tasks, signal = new AbortController().signal) {
    for (const task of tasks) {
      if (signal.aborted) {
        break;
      }

      try {
        await task.run(signal);
      } catch (error) {
        const runtimeError = error instanceof Error ? error : new Error('Runtime task failed');
        options.onError?.(runtimeError, task);
      }
    }
  },
});
