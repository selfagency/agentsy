import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function isDiscordAdapterAvailable(): boolean {
  const DISCOVERED = Symbol.for("@agentsy/connectors/discord/discovered");
  if (Reflect.has(globalThis, DISCOVERED)) {
    return true;
  }

  try {
    require.resolve("discord.js");
    Reflect.set(globalThis, DISCOVERED, true);
    return true;
  } catch {
    return false;
  }
}

export class DiscordAdapterNotAvailableError extends Error {
  constructor() {
    super(
      "DiscordAdapter requires the discord.js peer dependency. Install it with pnpm add discord.js@^14."
    );
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "DiscordAdapterNotAvailableError",
    });
    Object.defineProperty(this, "message", {
      configurable: true,
      value:
        "DiscordAdapter requires the discord.js peer dependency. Install it with pnpm add discord.js@^14.",
    });
  }
}

export const DiscordAdapter = {
  connect: async () => {
    throw new DiscordAdapterNotAvailableError();
  },
  disconnect: async () => {
    throw new DiscordAdapterNotAvailableError();
  },
  onMessage: () => {
    throw new DiscordAdapterNotAvailableError();
  },
  send: async () => {
    throw new DiscordAdapterNotAvailableError();
  },
};
