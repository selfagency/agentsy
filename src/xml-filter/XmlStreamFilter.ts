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

export function createXmlStreamFilter(_options: CreateXmlStreamFilterOptions = {}): XmlStreamFilter {
  return new NoopXmlStreamFilter();
}
