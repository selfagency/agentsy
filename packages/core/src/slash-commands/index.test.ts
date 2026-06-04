import { describe, expect, it } from 'vitest';

import { loadSlashCommands } from './index.js';

const workspaceRoot = new URL('../../../../', import.meta.url).pathname;

describe('loadSlashCommands', () => {
  it('loads package-local YAML command manifests', () => {
    const commands = loadSlashCommands(workspaceRoot);

    expect(commands.map(command => command.name)).toContain('/model search');
    expect(commands.map(command => command.name)).toContain('/provider search');
    expect(commands.find(command => command.name === '/model search')?.packageName).toBe('models');
  });
});
