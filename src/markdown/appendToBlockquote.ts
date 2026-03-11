export function appendToBlockquote(text: string, atLineStart: boolean): string {
  if (!text) {
    return '';
  }

  return `${atLineStart ? '> ' : ''}${text.replace(/\n/g, '\n> ')}`;
}
