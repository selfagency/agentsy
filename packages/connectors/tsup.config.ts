import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  entry: {
    discord: 'src/discord.ts',
    index: 'src/index.ts',
    slack: 'src/slack.ts',
    telegram: 'src/telegram.ts'
  },
  external: ['@agentsy/core', '@agentsy/session', 'grammy', 'discord.js', '@slack/bolt'],
  format: ['esm'],
  treeshake: true
});
