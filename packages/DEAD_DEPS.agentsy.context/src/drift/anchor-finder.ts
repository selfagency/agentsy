export interface Anchor {
  content: string;
  importance: number;
  index: number;
  reason: string;
  type: 'tool-call' | 'directive' | 'decision' | 'state-change';
}

export interface AnchorFinderOptions {
  threshold?: number;
}

export interface AnchorMessageLike {
  content: string;
  role: string;
  toolUse?: { args: unknown; name: string };
}

function isDirective(content: string): boolean {
  const trimmed = content.trim();
  return (
    /^(use|switch|change|apply|set|update|modify|configure)/i.test(trimmed) || /^(now|then|next)\s+/i.test(trimmed)
  );
}

export function findAnchors(messages: readonly AnchorMessageLike[], options: AnchorFinderOptions = {}): Anchor[] {
  const threshold = options.threshold ?? 0.5;
  const anchors: Anchor[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined) {
      continue;
    }

    if (message.toolUse !== undefined) {
      anchors.push({
        content: `Tool: ${message.toolUse.name}`,
        importance: 0.95,
        index,
        reason: `Tool invocation ${message.toolUse.name} is a decision point`,
        type: 'tool-call'
      });
      continue;
    }

    if (message.role === 'user' && isDirective(message.content)) {
      anchors.push({
        content: message.content.slice(0, 80),
        importance: 0.85,
        index,
        reason: 'User directive changes task direction',
        type: 'directive'
      });
    }
  }

  return anchors.filter(anchor => anchor.importance >= threshold);
}
