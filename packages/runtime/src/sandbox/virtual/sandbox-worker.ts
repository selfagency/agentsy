import { createContext, runInContext } from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';

if (!parentPort) {
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
    log: (...args: any[]) => parentPort?.postMessage({ type: 'log', args }),
    error: (...args: any[]) => parentPort?.postMessage({ type: 'error', args }),
    warn: (...args: any[]) => parentPort?.postMessage({ type: 'warn', args }),
    info: (...args: any[]) => parentPort?.postMessage({ type: 'info', args })
  },
  process: {
    env: { ...env }
  },
  // Add other primitives if needed, but keep it minimal for security
  URL,
  TextEncoder,
  TextDecoder,
  Buffer
});

try {
  // Wrap code to support implicit return if it's a simple expression,
  // or just run as-is if it's a block.
  const result = runInContext(code, context, {
    timeout, // vm timeout provides a first layer, but worker.terminate() is the fallback
    displayErrors: true
  });

  parentPort.postMessage({ type: 'result', value: result });
} catch (error) {
  parentPort.postMessage({
    type: 'error',
    value: error instanceof Error ? { message: error.message, stack: error.stack } : error
  });
}
