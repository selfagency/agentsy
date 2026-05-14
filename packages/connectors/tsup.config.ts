import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    telegram: 'src/telegram.ts',
    discord: 'src/discord.ts',
    slack: 'src/slack.ts',
  },
  format: ['esm'],
  clean: true,
  external: ['@agentsy/core', '@agentsy/session', 'grammy', 'discord.js', '@slack/bolt'],
  treeshake: true,
});
