# `@agentsy/xml-filter`

- **Status:** Published
- **Role:** XML tag filtering and privacy-oriented scrubbing helpers

## Key exports

- `createXmlStreamFilter`
- `XmlStreamFilter`
- `tagLists`

## Where it fits

Use this package when you need to suppress or route XML-like tagged content, especially in provider outputs that mix content and control tags.

## Common neighbors

- `@agentsy/processor`
- `@agentsy/thinking`
- `@agentsy/formatting`

## Implementation example with neighbors

```ts
import { formatXmlLikeResponseForDisplay } from '@agentsy/formatting';
import { createXmlStreamFilter } from '@agentsy/xml-filter';

const filter = createXmlStreamFilter({ extraScrubTags: new Set(['think', 'context']) });

for await (const chunk of stream) {
  const visible = filter.write(chunk);
  console.log(formatXmlLikeResponseForDisplay(visible));
}

console.log(filter.end());
```
