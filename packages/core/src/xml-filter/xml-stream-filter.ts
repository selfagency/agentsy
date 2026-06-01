import type {
  SaxophoneCData,
  SaxophoneComment,
  SaxophoneTag,
  SaxophoneTagClose,
  SaxophoneText
} from './saxophone/index.js';
import Saxophone from './saxophone/index.js';
import { DEFAULT_SCRUB_TAG_NAMES, PRIVACY_TAG_NAMES } from './tag-lists.js';

export interface XmlStreamFilter {
  end(): string;
  write(chunk: string): string;
}

export interface CreateXmlStreamFilterOptions {
  enforcePrivacyTags?: boolean;
  extraScrubTags?: Set<string>;
  maxXmlNestingDepth?: number;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
  overrideScrubTags?: Set<string>;
}

const DEFAULT_MAX_XML_NESTING_DEPTH = 64;

function resolveScrubTagSet(options: CreateXmlStreamFilterOptions): Set<string> {
  if (options.overrideScrubTags) {
    const override = new Set(options.overrideScrubTags);
    const enforcePrivacyTags = options.enforcePrivacyTags ?? true;

    const missingPrivacyTags = [...PRIVACY_TAG_NAMES].filter(tag => !override.has(tag));
    if (missingPrivacyTags.length > 0 && enforcePrivacyTags) {
      for (const tag of missingPrivacyTags) {
        override.add(tag);
      }
      options.onWarning?.('Privacy-sensitive tags omitted from scrub override; enforcing defaults.', {
        missingPrivacyTags
      });
    }

    return override;
  }

  if (options.extraScrubTags) {
    return new Set([...DEFAULT_SCRUB_TAG_NAMES, ...options.extraScrubTags]);
  }

  return new Set(DEFAULT_SCRUB_TAG_NAMES);
}

export function createXmlStreamFilter(options: CreateXmlStreamFilterOptions = {}): XmlStreamFilter {
  const scrubTagNames = resolveScrubTagSet(options);
  const parser = new Saxophone();
  const maxXmlNestingDepth = options.maxXmlNestingDepth ?? DEFAULT_MAX_XML_NESTING_DEPTH;

  let skipDepth = 0;
  let parseDepth = 0;
  let overflowStartDepth: number | null = null;
  let buffer = '';

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: refactor planned
  parser.on('tagopen', (tag: SaxophoneTag) => {
    if (!tag.isSelfClosing) {
      parseDepth++;
      if (maxXmlNestingDepth > 0 && overflowStartDepth === null && parseDepth > maxXmlNestingDepth) {
        overflowStartDepth = parseDepth;
        options.onWarning?.('XML nesting depth exceeded maxXmlNestingDepth; suppressing nested segment.', {
          depth: parseDepth,
          maxXmlNestingDepth
        });
      }
    }

    if (overflowStartDepth !== null) {
      return;
    }

    if (scrubTagNames.has(tag.name)) {
      if (!tag.isSelfClosing) {
        skipDepth++;
      }
    } else if (skipDepth === 0) {
      const attrs = tag.attrs ? ` ${tag.attrs}` : '';
      const selfClose = tag.isSelfClosing ? ' /' : '';
      buffer += `<${tag.name}${attrs}${selfClose}>`;
    }
  });

  parser.on('tagclose', (tag: SaxophoneTagClose) => {
    if (overflowStartDepth !== null) {
      if (parseDepth > 0) {
        parseDepth--;
      }

      if (parseDepth < overflowStartDepth) {
        overflowStartDepth = null;
      }
      return;
    }

    if (scrubTagNames.has(tag.name)) {
      if (skipDepth > 0) {
        skipDepth--;
      }
    } else if (skipDepth === 0) {
      buffer += `</${tag.name}>`;
    }

    if (parseDepth > 0) {
      parseDepth--;
    }
  });

  parser.on('text', (text: SaxophoneText) => {
    if (overflowStartDepth === null && skipDepth === 0) {
      buffer += text.contents;
    }
  });

  parser.on('cdata', (cdata: SaxophoneCData) => {
    if (overflowStartDepth === null && skipDepth === 0) {
      buffer += `<![CDATA[${cdata.contents}]]>`;
    }
  });

  parser.on('comment', (comment: SaxophoneComment) => {
    if (overflowStartDepth === null && skipDepth === 0) {
      buffer += `<!--${comment.contents}-->`;
    }
  });

  parser.on('error', () => {
    // Partial XML and malformed streaming fragments are expected.
  });

  return {
    end(): string {
      parser.end();
      return buffer;
    },
    write(chunk: string): string {
      parser.write(chunk);
      const delta = buffer;
      buffer = '';
      return delta;
    }
  };
}
