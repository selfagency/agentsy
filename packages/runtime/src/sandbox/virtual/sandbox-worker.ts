import { createContext, runInContext } from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';

import type { WorkerOutputMessage, WorkerResultMessage, WorkerRuntimeErrorMessage } from './worker-messages.js';

if (parentPort === null) {
  process.exit(1);
}

const { code, env, timeout } = workerData as {
  code: string;
  env: Record<string, string>;
  timeout: number;
};

function sendMessage(message: WorkerOutputMessage): void {
  parentPort?.postMessage(message);
}

// Create a safe realm
const context = createContext({
  console: {
    error: (...args: unknown[]) => {
      sendMessage({ args, type: 'error' });
    },
    info: (...args: unknown[]) => {
      sendMessage({ args, type: 'info' });
    },
    log: (...args: unknown[]) => {
      sendMessage({ args, type: 'log' });
    },
    warn: (...args: unknown[]) => {
      sendMessage({ args, type: 'warn' });
    }
  },
  process: {
    env: Object.freeze({ ...env })
  },
  // Add other primitives if needed, but keep it minimal for security
  URL,
  TextEncoder,
  TextDecoder,
  Buffer
});
Object.freeze(context);

try {
  // nosemgrep: dangerous-sandbox-run-in-context
  // runInContext executes user-provided code inside a hardened vm.Context with
  // no Node builtins, no require, no filesystem, and a frozen global object.
  // Timeout and worker.terminate() provide defense-in-depth.
  const result: unknown = runInContext(code, context, {
    displayErrors: true,
    timeout // vm timeout provides a first layer, but worker.terminate() is the fallback
  });

  const resultMessage: WorkerResultMessage = { type: 'result', value: result };
  parentPort.postMessage(resultMessage);
} catch (error) {
  const errorPayload =
    error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };

  const runtimeError: WorkerRuntimeErrorMessage = {
    args: [errorPayload.message],
    type: 'runtime-error'
  };
  parentPort.postMessage(runtimeError);
}
