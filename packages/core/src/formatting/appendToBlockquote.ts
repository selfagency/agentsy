export function appendToBlockquote(text: string, atLineStart: boolean): string {
  if (!text) {
    return "";
  }

  return `${atLineStart ? "> " : ""}${text.replaceAll("\n", "\n> ")}`;
}
