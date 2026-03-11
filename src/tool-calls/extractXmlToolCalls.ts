export interface XmlToolCall {
  name: string;
  parameters: Record<string, unknown>;
  format: 'bare-xml' | 'json-wrapped';
}

export function extractXmlToolCalls(_text: string, _knownTools: Set<string>): XmlToolCall[] {
  throw new Error(
    'extractXmlToolCalls is not implemented yet: XML/JSON tool call parsing has not been ported.',
  );
}
