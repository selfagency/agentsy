import { stripXmlContextTags } from '../context/stripXmlContextTags.js';

export function sanitizeNonStreamingModelOutput(text: string): string {
  const stripped = stripXmlContextTags(text);

  // Basic formatting for display
  return (
    stripped
      .trim()
      // Normalize newlines
      .replaceAll('\r\n', '\n')
      // Remove excessive consecutive blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Optional: Add basic indentation for code-like content
      .replace(/^```(\w+)?\s*$/gm, '')
      // Convert multiple spaces to single space for cleaner output
      .replace(/[ \t]+/g, ' ')
  );
}
