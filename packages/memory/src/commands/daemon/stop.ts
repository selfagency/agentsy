import { Command } from '@oclif/core';

import { stopDaemon } from '../../mcp/daemon.js';

export default class DaemonStop extends Command {
  static readonly description = 'Stop the running memory daemon';

  static readonly examples = ['<%= config.bin %> daemon:stop'];

  async run(): Promise<void> {
    this.log('Stopping memory daemon...');
    await stopDaemon();
    this.log('Daemon stopped.');
  }
}
