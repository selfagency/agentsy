import { createContext, runInContext } from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';

if (parentPort === null) {
  process.exit(1);
}

const { code, env, timeout } = workerData as {
  code: string;
  env: Record<string, string>;
  timeout: number;
};

// Create a safe realm
const context = createContext({
  console: {
    error: (...args: unknown[]) => parentPort?.postMessage({ args, type: 'error' }),
    info: (...args: unknown[]) => parentPort?.postMessage({ args, type: 'info' }),
    log: (...args: unknown[]) => parentPort?.postMessage({ args, type: 'log' }),
    warn: (...args: unknown[]) => parentPort?.postMessage({ args, type: 'warn' })
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
  // Wrap code to support implicit return if it's a simple expression,
  // or just run as-is if it's a block.
  const result = runInContext(code, context, {
    displayErrors: true,
    timeout // vm timeout provides a first layer, but worker.terminate() is the fallback
  });

  parentPort.postMessage({ type: 'result', value: result });
} catch (error) {
  const errorPayload =
    error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };

  parentPort.postMessage({
    args: [errorPayload.message],
    type: 'runtime-error'
  });
}
