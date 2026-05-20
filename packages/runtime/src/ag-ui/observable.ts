/**
 * Observable Adapter
 *
 * Converts AsyncGenerator<T> to RxJS Observable<T> for direct interoperability
 * with AG-UI's AbstractAgent and other Observable-based consumers.
 *
 * This enables users to:
 * - Use toAgUiStream() output directly with RxJS operators (map, filter, etc.)
 * - Integrate with AG-UI's AbstractAgent.run() which expects Observable<BaseEvent>
 * - Avoid tight coupling to RxJS while remaining compatible
 */

/**
 * Represents an Observable-like interface.
 * Accepts RxJS Observable, zen-observable, or similar.
 *
 * We use a structural type here to avoid hard dependency on rxjs.
 */
export interface Observable<T> {
  subscribe(observer: Partial<Observer<T>>): Subscription;
  subscribe(
    next: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null
  ): Subscription;
}

/**
 * Observer interface.
 */
export interface Observer<T> {
  next: (value: T) => void;
  error: (error: unknown) => void;
  complete: () => void;
}

/**
 * Subscription interface.
 */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Converts an AsyncGenerator to an Observable.
 *
 * This function creates a minimal Observable wrapper around an AsyncGenerator.
 * It works with any Observable library that implements the standard Observable contract
 * (RxJS, zen-observable, xstream, etc.).
 *
 * @param generator - AsyncGenerator to convert
 * @returns Observable that emits all generator values, then completes
 */
export function toObservable<T>(generator: AsyncGenerator<T>): Observable<T> {
  return {
    subscribe(
      observerOrNext: Partial<Observer<T>> | ((value: T) => void) | null,
      error?: ((error: unknown) => void) | null,
      complete?: (() => void) | null
    ) {
      // Normalize observer
      let observer: Partial<Observer<T>>;

      if (typeof observerOrNext === 'function') {
        observer = {
          next: observerOrNext,
          ...(error !== null && error !== undefined && { error }),
          ...(complete !== null && complete !== undefined && { complete })
        };
      } else {
        observer = observerOrNext ?? {};
      }

      let isCancelled = false;

      // Start consuming the generator
      void (async () => {
        try {
          for await (const value of generator) {
            if (isCancelled) {
              break;
            }
            observer.next?.(value);
          }
          if (!isCancelled) {
            observer.complete?.();
          }
        } catch (error) {
          if (!isCancelled) {
            observer.error?.(error);
          }
        } finally {
          // Clean up generator resources on completion or cancellation
          if (generator) {
            void generator.return(undefined);
          }
        }
      })();

      // Return subscription
      return {
        unsubscribe() {
          isCancelled = true;
        }
      };
    }
  };
}
