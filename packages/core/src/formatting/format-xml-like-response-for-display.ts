const MAX_XML_DISPLAY_INPUT_LENGTH = 1_000_000;
const ASCII_LETTER_REGEX = /[A-Za-z]/u;
const DISPLAY_TAG_CHAR_REGEX = /[A-Za-z0-9_.-]/u;
const TAG_SEPARATOR_REGEX = /[._-]+/gu;

interface XmlDisplayBlock {
  content: string;
  endIndex: number;
  tag: string;
}

function isAsciiLetter(char: string): boolean {
  return ASCII_LETTER_REGEX.test(char);
}

function isValidDisplayTagCharacter(char: string): boolean {
  return DISPLAY_TAG_CHAR_REGEX.test(char);
}

function parseDisplayBlock(text: string, startIndex: number): XmlDisplayBlock | null {
  if (text[startIndex] !== '<') {
    return null;
  }

  const firstTagChar = text[startIndex + 1];
  if (firstTagChar === undefined || (firstTagChar !== '_' && !isAsciiLetter(firstTagChar))) {
    return null;
  }

  let tagEnd = startIndex + 2;
  while (tagEnd < text.length && isValidDisplayTagCharacter(text[tagEnd] ?? '')) {
    tagEnd += 1;
  }

  const tag = text.slice(startIndex + 1, tagEnd);
  const openEnd = text.indexOf('>', tagEnd);
  if (tag.length === 0 || openEnd === -1) {
    return null;
  }

  const closeStart = text.indexOf(`</${tag}>`, openEnd + 1);
  if (closeStart === -1) {
    return null;
  }

  return {
    content: text.slice(openEnd + 1, closeStart),
    endIndex: closeStart + tag.length + 3,
    tag
  };
}

export function formatXmlLikeResponseForDisplay(text: string): string {
  if (text === '' || !text.includes('<') || !text.includes('>') || text.length > MAX_XML_DISPLAY_INPUT_LENGTH) {
    return text;
  }

  let replaced = false;

  let cursor = 0;
  let transformed = '';

  while (cursor < text.length) {
    const nextOpen = text.indexOf('<', cursor);
    if (nextOpen === -1) {
      transformed += text.slice(cursor);
      break;
    }

    transformed += text.slice(cursor, nextOpen);
    const block = parseDisplayBlock(text, nextOpen);
    if (block === null) {
      transformed += '<';
      cursor = nextOpen + 1;
      continue;
    }

    const tag = block.tag.replaceAll(TAG_SEPARATOR_REGEX, ' ').trim();
    const title = `${tag.at(0)?.toUpperCase() ?? ''}${tag.slice(1)}`;
    transformed += `\n\n**${title}**\n${block.content.trim()}\n\n`;
    replaced = true;
    cursor = block.endIndex;
  }

  return replaced ? transformed.trim() : text;
}
