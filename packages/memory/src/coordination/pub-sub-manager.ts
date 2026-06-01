export type ChannelListener<T> = (payload: T) => void;

export interface PubSubManager {
  publish<TPayload>(channel: string, payload: TPayload): Promise<void>;
  subscribe<TPayload>(channel: string, listener: ChannelListener<TPayload>): () => void;
  subscriberCount(channel: string): number;
}

export function createInMemoryPubSubManager(): PubSubManager {
  const listeners = new Map<string, Set<ChannelListener<unknown>>>();

  return {
    publish<TPayload>(channel: string, payload: TPayload): Promise<void> {
      const channelListeners = listeners.get(channel);
      if (!channelListeners) {
        return Promise.resolve();
      }

      for (const listener of channelListeners) {
        (listener as ChannelListener<TPayload>)(payload);
      }

      return Promise.resolve();
    },

    subscribe<TPayload>(channel: string, listener: ChannelListener<TPayload>) {
      const current = listeners.get(channel) ?? new Set<ChannelListener<unknown>>();
      current.add(listener as ChannelListener<unknown>);
      listeners.set(channel, current);

      return () => {
        const channelListeners = listeners.get(channel);
        if (!channelListeners) {
          return;
        }

        channelListeners.delete(listener as ChannelListener<unknown>);

        if (channelListeners.size === 0) {
          listeners.delete(channel);
        }
      };
    },

    subscriberCount(channel: string) {
      return listeners.get(channel)?.size ?? 0;
    }
  };
}
