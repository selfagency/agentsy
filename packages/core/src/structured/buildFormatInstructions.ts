export function buildFormatInstructions(schema: Record<string, unknown>): string {
  const schemaText = JSON.stringify(schema, null, 2);
  return [
    'Return output as a valid JSON instance that conforms to the following JSON Schema.',
    'Do not wrap the JSON in markdown fences and do not add explanatory prose.',
    'JSON Schema:',
    schemaText
  ].join('\n\n');
}
