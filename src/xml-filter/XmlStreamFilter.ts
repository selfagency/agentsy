import Saxophone, {
  type SaxophoneCData,
  type SaxophoneComment,
  type SaxophoneTag,
  type SaxophoneText,
} from 'saxophone';

import { DEFAULT_SCRUB_TAG_NAMES } from './tagLists.js';

export interface XmlStreamFilter {
  write(chunk: string): string;
  end(): string;
}

export interface CreateXmlStreamFilterOptions {
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
}

function resolveScrubTagSet(options: CreateXmlStreamFilterOptions): Set<string> {
  if (options.overrideScrubTags) {
    return new Set(options.overrideScrubTags);
  }

  if (options.extraScrubTags) {
    return new Set([...DEFAULT_SCRUB_TAG_NAMES, ...options.extraScrubTags]);
  }

  return new Set(DEFAULT_SCRUB_TAG_NAMES);
}

export function createXmlStreamFilter(options: CreateXmlStreamFilterOptions = {}): XmlStreamFilter {
  const scrubTagNames = resolveScrubTagSet(options);
  const parser = new Saxophone();

  let skipDepth = 0;
  let buffer = '';

  parser.on('tagopen', (tag: SaxophoneTag) => {
    if (scrubTagNames.has(tag.name)) {
      skipDepth++;
    } else if (skipDepth === 0) {
      buffer += `<${tag.name}${tag.attrs ? ` ${tag.attrs}` : ''}${tag.isSelfClosing ? ' /' : ''}>`;
    }
  });

  parser.on('tagclose', (tag: SaxophoneTag) => {
    if (scrubTagNames.has(tag.name)) {
      skipDepth--;
    } else if (skipDepth === 0) {
      buffer += `</${tag.name}>`;
    }
  });

  parser.on('text', (text: SaxophoneText) => {
    if (skipDepth === 0) {
      buffer += text.contents;
    }
  });

  parser.on('cdata', (cdata: SaxophoneCData) => {
    if (skipDepth === 0) {
      buffer += `<![CDATA[${cdata.contents}]]>`;
    }
  });

  parser.on('comment', (comment: SaxophoneComment) => {
    if (skipDepth === 0) {
      buffer += `<!--${comment.contents}-->`;
    }
  });

  parser.on('error', () => {
    // Partial XML and malformed streaming fragments are expected.
  });

  return {
    write(chunk: string): string {
      parser.write(chunk);
      const delta = buffer;
      buffer = '';
      return delta;
    },
    end(): string {
      parser.end();
      return buffer;
    },
  };
}
