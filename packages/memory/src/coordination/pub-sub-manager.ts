export type ChannelListener<T> = (payload: T) => void;

export interface PubSubManager {
  subscribe(channel: string, listener: ChannelListener<unknown>): () => void;
  publish(channel: string, payload: unknown): Promise<void>;
  subscriberCount(channel: string): number;
}

export function createInMemoryPubSubManager(): PubSubManager {
  const listeners = new Map<string, Set<ChannelListener<unknown>>>();

  return {
    async publish(channel: string, payload: unknown) {
      const channelListeners = listeners.get(channel);
      if (!channelListeners) {
        return;
      }

      for (const listener of channelListeners) {
        listener(payload);
      }
    },

    subscribe(channel: string, listener: ChannelListener<unknown>) {
      const current = listeners.get(channel) ?? new Set<ChannelListener<unknown>>();
      current.add(listener);
      listeners.set(channel, current);

      return () => {
        const channelListeners = listeners.get(channel);
        if (!channelListeners) {
          return;
        }

        channelListeners.delete(listener);

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

export function createInMemoryPubSubManager(): PubSubManager {
  const listeners = new Map<string, Set<ChannelListener<unknown>>>();

  return {
    async publish<TPayload>(channel: string, payload: TPayload) {
      const channelListeners = listeners.get(channel);
      if (!channelListeners) {
        return;
      }

      for (const listener of channelListeners) {
        (listener as ChannelListener<TPayload>)(payload);
      }
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
