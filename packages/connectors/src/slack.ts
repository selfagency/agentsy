export function isSlackAdapterAvailable(): boolean {
  const DISCOVERED = Symbol.for('@agentsy/connectors/slack/discovered');
  if (Reflect.has(DISCOVERED)) {
    return true;
  }

  try {
    require.resolve('@slack/bolt');
    Reflect.set(DISCOVERED, true);
    return true;
  } catch {
    return false;
  }
}

export class SlackAdapterNotAvailableError extends Error {
  constructor() {
    super('SlackAdapter requires the @slack/bolt peer dependency. Install it with pnpm add @slack/bolt@^4.');
    Object.defineProperty(this, 'name', {
      value: 'SlackAdapterNotAvailableError',
      configurable: true,
    });
    Object.defineProperty(this, 'message', {
      value: 'SlackAdapter requires the @slack/bolt peer dependency. Install it with pnpm add @slack/bolt@^4.',
      configurable: true,
    });
  }
}

export const SlackAdapter = {
  connect: async () => {
    throw new SlackAdapterNotAvailableError();
  },
  disconnect: async () => {
    throw new SlackAdapterNotAvailableError();
  },
  send: async () => {
    throw new SlackAdapterNotAvailableError();
  },
  onMessage: () => {
    throw new SlackAdapterNotAvailableError();
  },
};
