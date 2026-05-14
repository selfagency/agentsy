import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function isTelegramAdapterAvailable(): boolean {
  const DISCOVERED = Symbol.for('@agentsy/connectors/telegram/discovered');
  if (Reflect.has(globalThis, DISCOVERED)) {
    return true;
  }

  try {
    require.resolve('grammy');
    Reflect.set(globalThis, DISCOVERED, true);
    return true;
  } catch {
    return false;
  }
}

export class TelegramAdapterNotAvailableError extends Error {
  constructor() {
    super('TelegramAdapter requires the grammy peer dependency. Install it with pnpm add grammy@^1.');
    Object.defineProperty(this, 'name', {
      value: 'TelegramAdapterNotAvailableError',
      configurable: true,
    });
    Object.defineProperty(this, 'message', {
      value: 'TelegramAdapter requires the grammy peer dependency. Install it with pnpm add grammy@^1.',
      configurable: true,
    });
  }
}

export const TelegramAdapter = {
  connect: async () => {
    throw new TelegramAdapterNotAvailableError();
  },
  disconnect: async () => {
    throw new TelegramAdapterNotAvailableError();
  },
  send: async () => {
    throw new TelegramAdapterNotAvailableError();
  },
  onMessage: () => {
    throw new TelegramAdapterNotAvailableError();
  },
};
