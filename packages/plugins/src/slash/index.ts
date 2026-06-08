export type SlashCommandDomain = 'model' | 'provider' | 'agent' | 'skills';

export type SlashCommandAction = 'search' | 'select' | 'refine' | 'list' | 'show';

export interface SlashCommandDescriptor {
  readonly action: SlashCommandAction;
  readonly command: `/${SlashCommandDomain} ${SlashCommandAction}`;
  readonly description: string;
  readonly domain: SlashCommandDomain;
}

export const modelCommands = [
  {
    action: 'search',
    command: '/model search',
    description: 'Search models by criteria',
    domain: 'model'
  },
  {
    action: 'select',
    command: '/model select',
    description: 'Select a model',
    domain: 'model'
  },
  {
    action: 'refine',
    command: '/model refine',
    description: 'Adjust selection criteria',
    domain: 'model'
  }
] as const satisfies readonly SlashCommandDescriptor[];

export const providerCommands = [
  {
    action: 'search',
    command: '/provider search',
    description: 'Discover available providers',
    domain: 'provider'
  }
] as const satisfies readonly SlashCommandDescriptor[];

export const agentCommands = [
  {
    action: 'list',
    command: '/agent list',
    description: 'List available agents',
    domain: 'agent'
  },
  {
    action: 'show',
    command: '/agent show',
    description: 'Describe an agent by ID',
    domain: 'agent'
  },
  {
    action: 'select',
    command: '/agent select',
    description: 'Switch to a different agent',
    domain: 'agent'
  }
] as const satisfies readonly SlashCommandDescriptor[];

export const skillsCommands = [
  {
    action: 'list',
    command: '/skills list',
    description: 'List available skills',
    domain: 'skills'
  },
  {
    action: 'show',
    command: '/skills show',
    description: 'Describe a skill by name',
    domain: 'skills'
  }
] as const satisfies readonly SlashCommandDescriptor[];

export const slashCommands = [...modelCommands, ...providerCommands, ...agentCommands, ...skillsCommands] as const;

export function listSlashCommands(domain?: SlashCommandDomain): readonly SlashCommandDescriptor[] {
  return domain === undefined ? [...slashCommands] : slashCommands.filter(command => command.domain === domain);
}
