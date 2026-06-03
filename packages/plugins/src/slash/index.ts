export type SlashCommandDomain = 'model' | 'provider';

export type SlashCommandAction = 'search' | 'select' | 'refine';

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

export const slashCommands = [...modelCommands, ...providerCommands] as const;

export function listSlashCommands(domain?: SlashCommandDomain): readonly SlashCommandDescriptor[] {
  return domain === undefined ? [...slashCommands] : slashCommands.filter(command => command.domain === domain);
}
