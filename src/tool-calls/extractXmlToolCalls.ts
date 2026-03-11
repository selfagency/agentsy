export interface XmlToolCall {
  name: string;
  parameters: Record<string, unknown>;
  format: 'bare-xml' | 'json-wrapped';
}

export function extractXmlToolCalls(_text: string, _knownTools: Set<string>): XmlToolCall[] {
  return [];
}
