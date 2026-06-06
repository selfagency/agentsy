export function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

export function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}
