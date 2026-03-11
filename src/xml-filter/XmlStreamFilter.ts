export interface XmlStreamFilter {
  write(chunk: string): string;
  end(): string;
}

export interface CreateXmlStreamFilterOptions {
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
}

class NoopXmlStreamFilter implements XmlStreamFilter {
  public write(chunk: string): string {
    return chunk;
  }

  public end(): string {
    return '';
  }
}

export function createXmlStreamFilter(options: CreateXmlStreamFilterOptions = {}): XmlStreamFilter {
  const hasOverrideScrubTags =
    options.overrideScrubTags !== undefined && options.overrideScrubTags.size > 0;
  const hasExtraScrubTags =
    options.extraScrubTags !== undefined && options.extraScrubTags.size > 0;

  if (hasOverrideScrubTags || hasExtraScrubTags) {
    throw new Error(
      'XML stream filtering with scrub tags is not implemented yet. ' +
        'Options "extraScrubTags" and "overrideScrubTags" are not currently supported, ' +
        'to avoid returning unfiltered XML when scrubbing is expected.',
    );
  }

  return new NoopXmlStreamFilter();
}
