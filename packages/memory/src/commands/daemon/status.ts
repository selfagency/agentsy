import { Command } from '@oclif/core';

import { getDaemonStatus } from '../../mcp/daemon.js';

export default class DaemonStatus extends Command {
  static description = 'Check the status of the memory daemon';

  static examples = ['<%= config.bin %> daemon:status'];

  async run(): Promise<void> {
    const status = await getDaemonStatus();

    if (!status.running) {
      this.log('Daemon is not running.');
      return;
    }

    this.log(`Daemon is running (PID: ${status.pid})`);
    if (status.uptime !== null) {
      this.log(`Uptime: ${Math.round(status.uptime / 1000)}s`);
    }
  }
}
