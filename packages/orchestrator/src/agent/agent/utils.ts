export function mergeCallbacks<T extends (...args: any[]) => void | Promise<void>>(a?: T, b?: T): T | undefined {
  if (!a) return b;
  if (!b) return a;

  return (async (...args: Parameters<T>) => {
    await a(...args);
    await b(...args);
  }) as T;
}
