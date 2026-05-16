export type ChannelListener<TPayload> = (payload: TPayload) => void;

export interface PubSubManager {
  subscribe<TPayload>(
    channel: string,
    listener: ChannelListener<TPayload>
  ): () => void;
  publish<TPayload>(channel: string, payload: TPayload): Promise<void>;
  subscriberCount(channel: string): number;
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
      const current =
        listeners.get(channel) ?? new Set<ChannelListener<unknown>>();
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
    },
  };
}
