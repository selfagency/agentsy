export type MergeableCallback<TArgs extends unknown[]> = (...args: TArgs) => void | Promise<void>;

export function mergeCallbacks<TArgs extends unknown[]>(
  a?: MergeableCallback<TArgs>,
  b?: MergeableCallback<TArgs>
): MergeableCallback<TArgs> | undefined {
  if (!a) {
    return b;
  }

  if (!b) {
    return a;
  }

  return async (...args: TArgs) => {
    await a(...args);
    await b(...args);
  };
}
